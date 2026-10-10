const BattleManager = require('./BattleManager');

const PHASE = Object.freeze({
    IDLE: 'idle',
    BETTING: 'betting',
    FIGHTING: 'fighting',
    VICTORY: 'victory',
});

const fighterName = (p) => (p?.ident ?? '').split(': ')[1] ?? p?.ident ?? 'Unknown';

/**
 * Owns the show's lifecycle. Two kinds of time live here and they are deliberately separate:
 *
 *  - Wall-clock deadlines (betting window): the server's clock. Chat/Streamer.bot care about these.
 *  - Presentation time (how long a turn takes to animate): the OVERLAY's clock. The simulator is
 *    effectively instant, so the server never advances past what the overlay has acknowledged.
 *
 * Flow control is ack-gated and lock-step:
 *    advance() -> sim runs ONE turn -> 'turn' batch sent -> overlay animates -> overlay 'ack'
 *             -> (only now) tell Streamer.bot PB_READY_FOR_NEXT_TURN / PB_BATTLE_ENDED
 *
 * Anything an outside viewer could use to learn an outcome (winner, "battle over") is only emitted
 * after the overlay has actually shown it.
 */
class BattleFlow {
    constructor({ hub, streamerBot, config, manager = BattleManager, logger = console, now = Date.now }) {
        this.hub = hub;
        this.sb = streamerBot;
        this.cfg = config;
        this.manager = manager;
        this.log = logger;
        this.now = now;

        this.phase = PHASE.IDLE;
        this.battle = null;
        this.seq = 0;               // monotonic across battles
        this.lastAckedSeq = 0;
        this.inFlight = null;       // { seq, state, timer }  batch sent, not yet acked
        this.presented = null;      // raw state as the overlay last SHOWED it (never ahead of the screen)
        this.bets = { p1Total: 0, p2Total: 0 };
        this.deadline = null;
        this.bettingTimer = null;
        this.autoTimer = null;
        this.busy = false;          // start()/advance() currently awaiting the sim
    }

    attach() {
        this.hub.on('connection', (ws) => this._onConnection(ws));
        this.hub.on('ack', (msg) => this._onAck(msg));
        this.hub.on('command', (msg) => this.command(msg.name));
        this.sb.on('action', (name, data) => this._onStreamerBotAction(name, data));
        return this;
    }

    // ---------- inputs (Streamer.bot, overlay buttons, HTTP) ----------

    async command(name) {
        switch (name) {
            case 'start':  return this.start();
            case 'begin':  return this.beginFighting();
            case 'next':   return this.advance();
            case 'reset':  return this.reset();
            default:       return { ok: false, reason: `unknown command ${name}` };
        }
    }

    _onStreamerBotAction(name, data) {
        switch (name) {
            case 'PB_START_BATTLE': return void this.start();
            case 'PB_NEXT_TURN':    return void this.advance();
            case 'PB_BET_UPDATE':   return this.setBets(data.p1Total, data.p2Total);
        }
    }

    // ---------- lifecycle ----------

    async start() {
        if (this.busy || this.phase === PHASE.BETTING || this.phase === PHASE.FIGHTING) {
            return { ok: false, reason: `busy (${this.phase})` };
        }
        this.busy = true;
        try {
            this._teardown();

            const battle = this.manager.createBattle();
            await battle.startBattle();
            await battle.waitUntilReady();
            this.battle = battle;

            this.bets = { p1Total: 0, p2Total: 0 };
            this.presented = this._stripLog(battle.getState());
            this.phase = PHASE.BETTING;
            this.deadline = this.cfg.BETTING_MS == null ? null : this.now() + this.cfg.BETTING_MS;

            this.hub.broadcast(this._snapshot());
            this._notifyStreamerBot('PB_ANNOUNCE_CONTESTANTS', {
                battleId: battle.id,
                player1: fighterName(battle.state.player1),
                player2: fighterName(battle.state.player2),
                deadline: this.deadline,
            }, `announce:${battle.id}`);

            if (this.cfg.BETTING_MS != null) {
                this.bettingTimer = setTimeout(() => this.beginFighting(), this.cfg.BETTING_MS);
            }
            return { ok: true, battleId: battle.id };
        } catch (err) {
            this.log.error('[BattleFlow] start failed:', err);
            this._teardown();
            this.phase = PHASE.IDLE;
            this.hub.broadcast(this._snapshot());
            return { ok: false, reason: err.message };
        } finally {
            this.busy = false;
        }
    }

    async beginFighting() {
        if (this.phase !== PHASE.BETTING || !this.battle) return { ok: false, reason: `not betting (${this.phase})` };
        clearTimeout(this.bettingTimer);
        this.bettingTimer = null;
        this.deadline = null;
        this.phase = PHASE.FIGHTING;
        const battle = this.battle;

        battle.beginBattle();
        try {
            await battle.waitUntilTurnStarted();
        } catch (err) {
            this.log.error('[battleflow] battle failed to start:', err);
        }
        if (this.battle !== battle) return { ok: false, reason: 'reset during start' };

        this.hub.broadcast({ type: 'phase', phase: this.phase, deadline: null });
        this._notifyStreamerBot('PB_BATTLE_STARTING', { battleId: battle.id }, `starting:${battle.id}`);
        this._signalReady(0);
        return { ok: true };
    }

    async advance() {
        if (this.phase !== PHASE.FIGHTING || !this.battle) return { ok: false, reason: `not fighting (${this.phase})` };
        if (this.busy || this.inFlight) return { ok: false, reason: 'previous turn not yet presented' };
        clearTimeout(this.autoTimer);
        this.busy = true;
        const battle = this.battle;
        try {
            const state = await battle.playTurn();
            if (this.battle !== battle) return { ok: false, reason: 'reset during turn' };

            const seq = ++this.seq;
            const entries = state.turnLog.length;
            const watchdogMs = entries * this.cfg.TURN_ENTRY_MS + this.cfg.ACK_SLACK_MS;
            this.inFlight = { seq, state, timer: setTimeout(() => this._onAckTimeout(seq), watchdogMs) };

            this.hub.broadcast({ type: 'turn', seq, battleId: battle.id, state });
            return { ok: true, seq };
        } catch (err) {
            this.log.error('[battleflow] advance failed:', err.message);
            return { ok: false, reason: err.message };
        } finally {
            this.busy = false;
        }
    }

    reset() {
        this._teardown();
        this.phase = PHASE.IDLE;
        this.presented = null;
        this.deadline = null;
        this.hub.broadcast(this._snapshot());
        return { ok: true };
    }

    setBets(p1Total = 0, p2Total = 0) {
        this.bets = { p1Total, p2Total };
        this.hub.broadcast({ type: 'bets', ...this.bets });
    }

    // ---------- acks: the only thing that advances the turn ----------

    _onAck(msg) {
        const f = this.inFlight;
        if (!f || msg.seq !== f.seq) return;
        this._complete(f, { forced: false });
    }

    _onAckTimeout(seq) {
        const f = this.inFlight;
        if (!f || f.seq !== seq) return;
        this.log.warn(`[battleflow] no ack for turn seq ${seq}; continuing (overlays connected: ${this.hub.clientCount})`);
        this._complete(f, { forced: true });
    }

    _complete(f, { forced }) {
        clearTimeout(f.timer);
        this.inFlight = null;
        this.lastAckedSeq = f.seq;
        this.presented = this._stripLog(f.state);
        const battle = this.battle;

        if (f.state.status === 'ended') {
            this.phase = PHASE.VICTORY;
            const key = f.state.winner === 'player1' ? 'player1' : 'player2';
            const winner = f.state[key];
            this.hub.broadcast({ type: 'phase', phase: this.phase, deadline: null, state: this.presented });
            // Winner is only revealed to the outside world once the overlay has shown it.
            this._notifyStreamerBot('PB_BATTLE_ENDED', {
                battleId: battle.id,
                winner: key,
                winnerName: fighterName(winner),
                winnerSpecies: winner?.details?.split(',')[0],
                turns: f.state.turn,
                forced,
            }, `ended:${battle.id}`, { ttlMs: 30 * 60_000 });
            return;
        }
        this._signalReady(f.state.turn);
    }

    _signalReady(turn) {
        const battleId = this.battle?.id;
        this._notifyStreamerBot('PB_READY_FOR_NEXT_TURN', { battleId, turn }, `ready:${battleId}`);
        if (this.cfg.AUTO_ADVANCE_MS != null) {
            this.autoTimer = setTimeout(() => this.advance(), this.cfg.AUTO_ADVANCE_MS);
        }
    }

    _onConnection(ws) {
        this.hub.send(ws, this._snapshot());
        // Overlay (re)joined mid-turn: replay the unacked batch on top of the last presented state.
        if (this.inFlight) {
            this.hub.send(ws, { type: 'turn', seq: this.inFlight.seq, battleId: this.battle.id, state: this.inFlight.state });
        }
    }

    _snapshot() {
        return {
            type: 'snapshot',
            mode: this.cfg.MODE,
            phase: this.phase,
            deadline: this.deadline,
            bets: this.bets,
            seq: this.lastAckedSeq,
            battleId: this.battle?.id ?? null,
            state: this.presented,
        };
    }

    status() {
        return {
            phase: this.phase,
            battleId: this.battle?.id ?? null,
            inFlightSeq: this.inFlight?.seq ?? null,
            lastAckedSeq: this.lastAckedSeq,
            overlays: this.hub.clientCount,
            streamerBotPending: this.sb.pending,
        };
    }

    _stripLog(state) {
        return { ...state, turnLog: [] };
    }

    _notifyStreamerBot(name, args, key, opts = {}) {
        try { this.sb.send(name, args, { key, ...opts }); }
        catch (err) { this.log.error(`[BattleFlow] streamer.bot send ${name} failed:`, err); }
    }

    _teardown() {
        clearTimeout(this.bettingTimer);
        clearTimeout(this.autoTimer);
        if (this.inFlight) clearTimeout(this.inFlight.timer);
        this.inFlight = null;
        if (this.battle) {
            this.battle.dispose();
            this.manager.removeBattle(this.battle.id);
            this.battle = null;
        }
    }
}

module.exports = { BattleFlow, PHASE };
