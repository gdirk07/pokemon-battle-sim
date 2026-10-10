const WebSocket = require('ws');
const { EventEmitter } = require('events');

class Hub extends EventEmitter {
    attach(server, { path = '/ws' } = {}) {
        // Scoped to a path so it never fights with Vite's HMR socket when proxied.
        this.wss = new WebSocket.Server({ server, path });
        this.wss.on('connection', (ws) => {
            ws.on('message', (raw) => {
                let msg;
                try { msg = JSON.parse(raw.toString()); } catch { return; }
                if (!msg || typeof msg.type !== 'string') return;
                this.emit('message', msg, ws);
                this.emit(msg.type, msg, ws);
            });
            ws.on('close', () => this.emit('disconnect', ws));
            ws.on('error', () => { /* surfaced via close */ });
            this.emit('connection', ws);
        });
        return this;
    }

    get clientCount() {
        return this.wss ? [...this.wss.clients].filter(c => c.readyState === WebSocket.OPEN).length : 0;
    }

    send(ws, data) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    }

    broadcast(data) {
        if (!this.wss) return;
        const payload = JSON.stringify(data);
        for (const client of this.wss.clients) {
            if (client.readyState === WebSocket.OPEN) client.send(payload);
        }
    }

    close() { this.wss?.close(); }
}

const hub = new Hub();
module.exports = hub;
module.exports.Hub = Hub;
