// @vitest-environment node
const WebSocket = require('ws');
const crypto = require('crypto');
const { StreamerBotClient } = require('../StreamerBotClient');

const silent = { log() {}, warn() {}, error() {} };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 3000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('until timeout'); await sleep(10); } };

function fakeServer(onConn) {
    const wss = new WebSocket.Server({ port: 0 });
    wss.on('connection', onConn);
    return { wss, url: `ws://localhost:${wss.address().port}` };
}

describe('StreamerBotClient', () => {
    it('subscribes, delivers DoAction, and clears the outbox only when Streamer.bot replies', async () => {
        const seen = [];
        const { wss, url } = fakeServer((ws) => ws.on('message', (raw) => {
            const m = JSON.parse(raw.toString()); seen.push(m);
            if (m.request === 'DoAction') ws.send(JSON.stringify({ id: m.id, status: 'ok' }));
        }));
        const c = new StreamerBotClient({ url, retryMs: 30, logger: silent });
        c.send('PB_BATTLE_ENDED', { battleId: 'b1' });        // queued BEFORE connecting
        expect(c.pending).toBe(1);
        c.connect();
        await until(() => c.pending === 0);
        expect(seen.find(m => m.request === 'Subscribe')).toBeTruthy();
        const act = seen.find(m => m.request === 'DoAction');
        expect(act).toMatchObject({ action: { name: 'PB_BATTLE_ENDED' }, args: { battleId: 'b1' } });
        c.close(); wss.close();
    });

    it('re-sends an unacknowledged action after the connection drops', async () => {
        let conns = 0; const actions = [];
        const { wss, url } = fakeServer((ws) => {
            conns++;
            ws.on('message', (raw) => {
                const m = JSON.parse(raw.toString());
                if (m.request !== 'DoAction') return;
                actions.push(m);
                if (conns === 1) ws.terminate();               // die before replying
                else ws.send(JSON.stringify({ id: m.id, status: 'ok' }));
            });
        });
        const c = new StreamerBotClient({ url, retryMs: 30, logger: silent });
        c.connect();
        await until(() => c.ready);
        c.send('PB_BATTLE_ENDED', { battleId: 'b2' });
        await until(() => c.pending === 0, 4000);
        expect(conns).toBeGreaterThanOrEqual(2);
        expect(actions).toHaveLength(2);
        expect(actions[0].id).toBe(actions[1].id);              // same id: Streamer.bot side can dedupe on args.battleId
        c.close(); wss.close();
    });

    it('does not re-send an unanswered message on the same connection (no accidental double payout)', async () => {
        const actions = [];
        const { wss, url } = fakeServer((ws) => ws.on('message', (raw) => {
            const m = JSON.parse(raw.toString()); if (m.request === 'DoAction') actions.push(m);   // never replies
        }));
        const c = new StreamerBotClient({ url, retryMs: 20, logger: silent });
        c.connect(); await until(() => c.ready);
        c.send('PB_X', { battleId: 'b3' }); c.send('PB_Y', {});
        await sleep(200);
        expect(actions.filter(a => a.action.name === 'PB_X')).toHaveLength(1);
        c.close(); wss.close();
    });

    it('dedupes by key (latest wins) while disconnected', async () => {
        const c = new StreamerBotClient({ url: 'ws://localhost:1', logger: silent });
        c.send('PB_READY_FOR_NEXT_TURN', { turn: 1 }, { key: 'ready:b' });
        c.send('PB_READY_FOR_NEXT_TURN', { turn: 2 }, { key: 'ready:b' });
        expect(c.pending).toBe(1);
    });

    it('emits incoming Custom actions in the shape the old overlay hook parsed', async () => {
        let sock;
        const { wss, url } = fakeServer((ws) => { sock = ws; });
        const c = new StreamerBotClient({ url, retryMs: 30, logger: silent });
        const got = [];
        c.on('action', (name, data) => got.push([name, data]));
        c.connect(); await until(() => c.ready);
        sock.send(JSON.stringify({ event: { source: 'General', type: 'Custom' }, data: { data: { action: { name: 'PB_BET_UPDATE' }, p1Total: 5, p2Total: 7 } } }));
        await until(() => got.length === 1);
        expect(got[0][0]).toBe('PB_BET_UPDATE');
        expect(got[0][1]).toMatchObject({ p1Total: 5, p2Total: 7 });
        c.close(); wss.close();
    });

    it('performs the salt/challenge handshake before subscribing when a password is set', async () => {
        const order = [];
        const salt = 'c2FsdA==', challenge = 'Y2hhbGxlbmdl';
        const { wss, url } = fakeServer((ws) => {
            ws.send(JSON.stringify({ request: 'Hello', info: {}, authentication: { salt, challenge } }));
            ws.on('message', (raw) => {
                const m = JSON.parse(raw.toString()); order.push(m.request);
                if (m.request === 'Authenticate') {
                    const h = (s) => crypto.createHash('sha256').update(s).digest('base64');
                    const expected = h(h('hunter2' + salt) + challenge);
                    ws.send(JSON.stringify({ id: m.id, status: m.authentication === expected ? 'ok' : 'error' }));
                }
            });
        });
        const c = new StreamerBotClient({ url, password: 'hunter2', logger: silent });
        c.connect(); await until(() => c.ready);
        expect(order.slice(0, 2)).toEqual(['Authenticate', 'Subscribe']);
        c.close(); wss.close();
    });
});
