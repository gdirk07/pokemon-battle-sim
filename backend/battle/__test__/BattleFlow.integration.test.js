// @vitest-environment node
// Real Showdown simulation + real WebSocket hub, with a fake overlay (own animation clock)
// and a fake Streamer.bot. Verifies the UI-paced guarantees.
const http = require('http');
const WebSocket = require('ws');
const { EventEmitter } = require('events');
const { Hub } = require('../../server/socket');
const { BattleFlow } = require('../BattleFlow');
const BattleManager = require('../BattleManager');

const silent = { log() {}, warn() {}, error() {} };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class FakeStreamerBot extends EventEmitter {
    constructor(timeline) { super(); this.timeline = timeline; this.pending = 0; this.sent = []; }
    send(name, args) { this.sent.push({ name, args }); this.timeline.push(`sb:${name}`); return 'id'; }
    connect() {} close() {}
}

class FakeOverlay {
    // msPerEntry: how long this overlay takes to "animate" one log entry (its own clock)
    constructor(port, timeline, { msPerEntry = 5, autoAck = true, name = 'overlay' } = {}) {
        this.timeline = timeline; this.msPerEntry = msPerEntry; this.autoAck = autoAck; this.name = name;
        this.messages = [];
        this.waiters = [];
        this.ws = new WebSocket(`ws://localhost:${port}/ws`);
        this.opened = new Promise(r => this.ws.on('open', r));
        this.ws.on('message', async (raw) => {
            const msg = JSON.parse(raw.toString());
            this.messages.push(msg);
            this.waiters.filter(w => w.pred(msg)).forEach(w => w.resolve(msg));
            this.waiters = this.waiters.filter(w => !w.pred(msg));
            if (msg.type === 'turn') {
                this.timeline.push(`turn:${msg.seq}`);
                if (this.autoAck) {
                    await sleep(msg.state.turnLog.length * this.msPerEntry);
                    this.ack(msg.seq);
                }
            }
        });
    }
    ack(seq) { this.timeline.push(`ack:${seq}`); this.ws.send(JSON.stringify({ type: 'ack', seq })); }
    next(pred, timeout = 15000) {
        const hit = this.messages.find(pred);
        if (hit) return Promise.resolve(hit);
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('overlay wait timeout')), timeout);
            this.waiters.push({ pred, resolve: (m) => { clearTimeout(t); resolve(m); } });
        });
    }
    close() { this.ws.close(); }
}

async function setup(cfgOverrides = {}) {
    const timeline = [];
    const hub = new Hub();
    const server = http.createServer();
    hub.attach(server);
    await new Promise(r => server.listen(0, r));
    const port = server.address().port;
    const sb = new FakeStreamerBot(timeline);
    const cfg = { BETTING_MS: 30, TURN_ENTRY_MS: 5, ACK_SLACK_MS: 5000, AUTO_ADVANCE_MS: null, ...cfgOverrides };
    const orch = new BattleFlow({ hub, streamerBot: sb, config: cfg, logger: silent }).attach();
    const stop = () => { orch.reset(); hub.close(); server.close(); BattleManager.battles.clear(); };
    return { timeline, hub, server, port, sb, orch, stop };
}

describe('UI-paced orchestration', () => {
    it('never runs ahead of the overlay and only reveals the winner after the overlay acks it', async () => {
        const t = await setup();
        const overlay = new FakeOverlay(t.port, t.timeline, { msPerEntry: 8 });
        await overlay.opened;

        // Streamer.bot behaviour: answer every READY with NEXT_TURN
        t.sb.send = (name, args) => {
            t.sb.sent.push({ name, args }); t.timeline.push(`sb:${name}`);
            if (name === 'PB_READY_FOR_NEXT_TURN') setImmediate(() => t.sb.emit('action', 'PB_NEXT_TURN', {}));
        };
        t.sb.emit('action', 'PB_START_BATTLE', {});

        await overlay.next(m => m.type === 'phase' && m.phase === 'victory', 30000);
        await sleep(20);

        const tl = t.timeline;
        expect(tl[0]).toBe('sb:PB_ANNOUNCE_CONTESTANTS');
        expect(tl[1]).toBe('sb:PB_BATTLE_STARTING');

        const turnSeqs = tl.filter(x => x.startsWith('turn:')).map(x => +x.split(':')[1]);
        expect(turnSeqs.length).toBeGreaterThan(0);
        for (const seq of turnSeqs) {
            const iTurn = tl.indexOf(`turn:${seq}`);
            const iAck = tl.indexOf(`ack:${seq}`);
            expect(iAck).toBeGreaterThan(iTurn);
            // the next batch (if any) is not sent until this one was acked
            const nextTurn = tl.indexOf(`turn:${seq + 1}`);
            if (nextTurn !== -1) expect(nextTurn).toBeGreaterThan(iAck);
        }
        const last = turnSeqs[turnSeqs.length - 1];
        const iEnded = tl.indexOf('sb:PB_BATTLE_ENDED');
        expect(iEnded).toBeGreaterThan(tl.indexOf(`ack:${last}`));     // ENDED only after the overlay acked the final batch
        expect(tl.filter(x => x === 'sb:PB_BATTLE_ENDED')).toHaveLength(1);
        expect(t.sb.sent.find(s => s.name === 'PB_BATTLE_ENDED').args.winnerName).toBeTruthy();
        // no READY after ENDED
        expect(tl.slice(iEnded + 1).includes('sb:PB_READY_FOR_NEXT_TURN')).toBe(false);

        overlay.close(); t.stop();
    }, 40000);

    it('does not leak the winner via snapshot/Streamer.bot while the final batch is unacked', async () => {
        const t = await setup();
        const overlay = new FakeOverlay(t.port, t.timeline, { autoAck: false });
        await overlay.opened;
        await t.orch.start();
        await t.orch.beginFighting();

        let finalMsg = null;
        for (let i = 0; i < 80 && !finalMsg; i++) {
            const r = await t.orch.advance();
            expect(r.ok).toBe(true);
            const msg = await overlay.next(m => m.type === 'turn' && m.seq === r.seq);
            if (msg.state.status === 'ended') finalMsg = msg; else overlay.ack(msg.seq);
            await sleep(5);
        }
        expect(finalMsg).not.toBeNull();
        expect(t.sb.sent.some(s => s.name === 'PB_BATTLE_ENDED')).toBe(false);

        // a fresh overlay joining now must not learn the winner
        const late = new FakeOverlay(t.port, t.timeline, { autoAck: false, name: 'late' });
        const snap = await late.next(m => m.type === 'snapshot');
        expect(snap.phase).toBe('fighting');
        expect(snap.state.winner ?? null).toBeNull();
        expect(snap.state.status).not.toBe('ended');
        const replay = await late.next(m => m.type === 'turn');
        expect(replay.seq).toBe(finalMsg.seq);                           // unacked batch is replayed

        late.ack(replay.seq);
        await sleep(30);
        expect(t.sb.sent.filter(s => s.name === 'PB_BATTLE_ENDED')).toHaveLength(1);
        expect(t.orch.status().phase).toBe('victory');
        // duplicate ack from the first overlay is ignored
        overlay.ack(finalMsg.seq); await sleep(20);
        expect(t.sb.sent.filter(s => s.name === 'PB_BATTLE_ENDED')).toHaveLength(1);

        overlay.close(); late.close(); t.stop();
    }, 40000);

    it('rejects PB_NEXT_TURN while the previous turn is still being presented', async () => {
        const t = await setup();
        const overlay = new FakeOverlay(t.port, t.timeline, { autoAck: false });
        await overlay.opened;
        await t.orch.start(); await t.orch.beginFighting();

        const first = await t.orch.advance();
        expect(first.ok).toBe(true);
        await overlay.next(m => m.type === 'turn' && m.seq === first.seq);
        const second = await t.orch.advance();
        expect(second).toMatchObject({ ok: false });
        expect(t.timeline.filter(x => x.startsWith('turn:'))).toHaveLength(1);

        overlay.close(); t.stop();
    });

    it('forces progress when no overlay ever acks (watchdog), instead of wedging the stream', async () => {
        const t = await setup({ TURN_ENTRY_MS: 0, ACK_SLACK_MS: 80 });
        await t.orch.start(); await t.orch.beginFighting();
        const r = await t.orch.advance();
        expect(r.ok).toBe(true);
        expect(t.sb.sent.filter(s => s.name === 'PB_READY_FOR_NEXT_TURN')).toHaveLength(1);   // only the initial one
        await sleep(200);
        const readyOrEnded = t.sb.sent.filter(s => ['PB_READY_FOR_NEXT_TURN', 'PB_BATTLE_ENDED'].includes(s.name));
        expect(readyOrEnded.length).toBeGreaterThanOrEqual(2);
        t.stop();
    });

    it('relays bet totals to the overlay and includes them in snapshots', async () => {
        const t = await setup({ BETTING_MS: null });
        const overlay = new FakeOverlay(t.port, t.timeline, { autoAck: false });
        await overlay.opened;
        await t.orch.start();
        t.sb.emit('action', 'PB_BET_UPDATE', { p1Total: 120, p2Total: 80 });
        const bets = await overlay.next(m => m.type === 'bets');
        expect(bets).toMatchObject({ p1Total: 120, p2Total: 80 });
        const late = new FakeOverlay(t.port, t.timeline, { autoAck: false });
        const snap = await late.next(m => m.type === 'snapshot');
        expect(snap).toMatchObject({ phase: 'betting', bets: { p1Total: 120, p2Total: 80 }, deadline: null });
        overlay.close(); late.close(); t.stop();
    });
});

describe('species selection', () => {
    const species = (p) => p.details.split(',')[0];

    it('starts a battle with the chosen species, resolving loose names', async () => {
        const t = await setup({ ALLOW_SPECIES_PICK: true });
        const r = await t.orch.start({ p1Species: 'iron crown', p2Species: 'hooh' });
        expect(r.ok).toBe(true);
        expect(species(t.orch.battle.state.player1)).toBe('Iron Crown');
        expect(species(t.orch.battle.state.player2)).toBe('Ho-Oh');
        t.stop();
    });

    it('leaves an omitted side random', async () => {
        const t = await setup({ ALLOW_SPECIES_PICK: true });
        expect((await t.orch.start({ p2Species: 'Roaring Moon' })).ok).toBe(true);
        expect(species(t.orch.battle.state.player2)).toBe('Roaring Moon');
        expect(t.orch.battle.state.player1).toBeTruthy();
        t.stop();
    });

    it('rejects species outside the pool without touching the current screen', async () => {
        const t = await setup({ ALLOW_SPECIES_PICK: true });
        expect((await t.orch.start()).ok).toBe(true);
        t.orch.reset();
        const r = await t.orch.start({ p1Species: 'Bulbasaur' });
        expect(r).toEqual({ ok: false, reason: expect.stringMatching(/not in the gen9randombattle pool/) });
        expect((await t.orch.start({ p1Species: 'Notamon' })).reason).toMatch(/Unknown species/);
        expect(t.orch.phase).toBe('idle');
        t.stop();
    });

    it('rejects picks when ALLOW_SPECIES_PICK is off (Streamer.bot path included)', async () => {
        const t = await setup({ ALLOW_SPECIES_PICK: false });
        expect((await t.orch.start({ p1Species: 'Ho-Oh' })).reason).toMatch(/disabled/);
        expect((await t.orch.start()).ok).toBe(true);       // plain random start still works
        t.stop();
    });

    it('passes PB_START_BATTLE species through to start()', async () => {
        const t = await setup({ ALLOW_SPECIES_PICK: true });
        const spy = vi.spyOn(t.orch, 'start');
        t.sb.emit('action', 'PB_START_BATTLE', { p1Species: 'Ho-Oh', p2Species: 'Iron Crown' });
        expect(spy).toHaveBeenCalledWith({ p1Species: 'Ho-Oh', p2Species: 'Iron Crown' });
        await spy.mock.results[0].value;
        t.stop();
    });
});
