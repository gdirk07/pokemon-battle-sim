const WebSocket = require('ws');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const sha256b64 = (s) => crypto.createHash('sha256').update(s).digest('base64');

/**
 * Backend-side Streamer.bot client.
 *  - send(): durable outbox. Messages get an id, are re-sent after a reconnect, and are removed
 *    only when Streamer.bot answers that id (or the ttl expires). Delivery is at-least-once, so
 *    every payload carries battleId so a Streamer.bot action can ignore a repeat.
 *  - emits 'action'(name, data) for Custom events fired from Streamer.bot (PB_START_BATTLE, ...)
 *  - emits 'connected' / 'disconnected'
 */
class StreamerBotClient extends EventEmitter {
    constructor({ url, password = null, retryMs = 3000, defaultTtlMs = 5 * 60_000, logger = console } = {}) {
        super();
        this.url = url;
        this.password = password;
        this.retryMs = retryMs;
        this.defaultTtlMs = defaultTtlMs;
        this.log = logger;
        this.outbox = new Map();      // id -> { payload, expires, key }
        this.ws = null;
        this.ready = false;           // authenticated + subscribed
        this.stopped = false;
        this.retryTimer = null;
    }

    connect() {
        this.stopped = false;
        this._open();
    }

    close() {
        this.stopped = true;
        clearTimeout(this.retryTimer);
        this.ws?.close();
    }

    get pending() { return this.outbox.size; }

    send(actionName, args = {}, { key = null, ttlMs = this.defaultTtlMs } = {}) {
        if (key) {
            for (const [id, m] of this.outbox) if (m.key === key) this.outbox.delete(id);
        }
        const id = crypto.randomUUID();
        this.outbox.set(id, {
            key,
            expires: Date.now() + ttlMs,
            sent: false,
            payload: { request: 'DoAction', action: { name: actionName }, args, id },
        });
        this._flush();
        return id;
    }

    _open() {
        const ws = new WebSocket(this.url);
        this.ws = ws;
        this.ready = false;

        ws.on('open', () => {
            // Without auth enabled Streamer.bot sends no Hello challenge, so subscribe straight away.
            // (If a Hello with `authentication` arrives we authenticate first - see _onMessage.)
            this._helloTimer = setTimeout(() => this._subscribe(), 400);
        });

        ws.on('message', (raw) => this._onMessage(raw));

        ws.on('close', () => {
            clearTimeout(this._helloTimer);
            const wasReady = this.ready;
            this.ready = false;
            if (wasReady) this.emit('disconnected');
            if (!this.stopped) this.retryTimer = setTimeout(() => this._open(), this.retryMs);
        });

        ws.on('error', (err) => { this.log.warn?.('[streamerbot] ws error:', err.message); });
    }

    _subscribe() {
        if (this.ready || this.ws?.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify({
            request: 'Subscribe',
            events: { General: ['Custom'] },
            id: 'pb-subscribe',
        }));
        this.ready = true;
        for (const m of this.outbox.values()) m.sent = false;
        this.emit('connected');
        this._flush();
    }

    _onMessage(raw) {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        // Auth handshake: server announces salt/challenge in Hello when a password is configured.
        if (msg.request === 'Hello' && msg.authentication) {
            clearTimeout(this._helloTimer);
            if (!this.password) {
                this.log.error?.('[streamerbot] server requires a password; set STREAMERBOT_PASSWORD');
                return;
            }
            const { salt, challenge } = msg.authentication;
            const secret = sha256b64(this.password + salt);
            const authentication = sha256b64(secret + challenge);
            this.ws.send(JSON.stringify({ request: 'Authenticate', authentication, id: 'pb-auth' }));
            return;
        }
        if (msg.id === 'pb-auth') {
            if (msg.status === 'ok') this._subscribe();
            else this.log.error?.('[streamerbot] authentication failed');
            return;
        }
        if (msg.id === 'pb-subscribe') return;

        // Response to one of our DoAction requests
        if (msg.id && this.outbox.has(msg.id)) {
            if (msg.status === 'ok') this.outbox.delete(msg.id);
            else this.log.warn?.(`[streamerbot] action failed (${msg.status}); will retry`, msg.error ?? '');
            return;
        }

        // Incoming Custom event
        if (msg.event?.type === 'Custom') {
            const inner = msg.data?.data ?? {};
            const name = inner.action?.name ?? inner.name;
            if (name) this.emit('action', name, inner);
        }
    }

    _flush() {
        if (!this.ready || this.ws?.readyState !== WebSocket.OPEN) return;
        const now = Date.now();
        for (const [id, m] of this.outbox) {
            if (m.expires < now) { this.outbox.delete(id); continue; }
            if (m.sent) continue;
            this.ws.send(JSON.stringify(m.payload));
            m.sent = true;
        }
    }
}

// Used in manual mode / tests: same surface, does nothing.
class NullStreamerBot extends EventEmitter {
    connect() {}
    close() {}
    send() { return null; }
    get pending() { return 0; }
}

module.exports = { StreamerBotClient, NullStreamerBot };
