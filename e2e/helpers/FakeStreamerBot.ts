import { EventEmitter } from "node:events";
import { WebSocketServer, WebSocket } from 'ws';

export interface ReceivedAction {
    name: string;
    args: any;
    id: string;
    at: number;
}

export class FakeStreamerBot extends EventEmitter {
    readonly actions: ReceivedAction[] = [];

    autoAdvance = false;
    autoAdvanceDelayMs = 50;

    private wss?: WebSocketServer;
    private sockets = new Set<WebSocket>();
    private subscribed = false;

    constructor(private port: number) { super(); }

    async start() {
        this.wss = new WebSocketServer({ port: this.port, host: 'localhost' });
        await new Promise<void>((resolve, reject) => {
            this.wss!.once('listening', resolve);
            this.wss!.once('error', reject);
        });

        this.wss.on('connection', (ws: any) => {
            this.sockets.add(ws);
            ws.on('close', () => { this.sockets.delete(ws); this.subscribed = this.sockets.size > 0 && this.subscribed; });
            ws.on('message', (raw: any) => this.onMessage(ws, JSON.parse(raw.toString())));
        });
    }

    async stop() {
        for (const ws of this.sockets) ws.terminate();
        await new Promise<void>((resolve) => this.wss?.close(() => resolve()) ?? resolve());
    }

    clear() { this.actions.length = 0; this.autoAdvance = false; }

    fire(name: string, data: Record<string, unknown> = {}) {
        const message = JSON.stringify({
            event: { source: 'General', type: 'Custom' },
            data: { data: { action: { name}, ...data } },
        });
        for (const ws of this.sockets) ws.send(message);
    }

    async waitForBackend(timeoutMs = 10_000) {
        if (this.subscribed) return;
        await this.waitFor(() => this.subscribed, 'subscribed', timeoutMs, 'backend never connected to the fake Streamer.bot');
    }

    async waitForAction(name: string, timeoutMs = 35_000): Promise<ReceivedAction> {
        const find = () => this.actions.find((a) => a.name === name);
        if (find()) return find()!;
        await this.waitFor(
            () => !!find(), 
            'action', 
            timeoutMs, `timed out waiting for ${name}. Received so far: [${this.actions.map(a => a.name).join(', ')}]`);
            return find()!;
    }

    names() { return this.actions.map((a) => a.name); }

    private onMessage(ws: WebSocket, msg: any) {
        if (msg.request === 'Subscribe') {
            this.subscribed = true;
            ws.send(JSON.stringify({ id: msg.id, status: 'ok' }));
            this.emit('subscribed');
            return;
        }
        if (msg.request === 'DoAction') {
            this.actions.push({ name: msg.action.name, args: msg.args, id: msg.id, at: Date.now() });
            ws.send(JSON.stringify({ id: msg.id, status: 'ok' }));
            this.emit('action');
            if (this.autoAdvance && msg.action.name === 'PB_READY_FOR_NEXT_TURN') {
                setTimeout(() => this.fire('PB_NEXT_TURN'), this.autoAdvanceDelayMs);
            }
        }
    }

    private waitFor(condition: () => boolean, event: string, timeoutMs: number, failure: string) {
        return new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => { this.off(event, check); reject(new Error(failure)); }, timeoutMs);
            const check = () => { if (condition()) { clearTimeout(timer); this.off(event, check); resolve(); } };
            this.on(event, check);
            check();
        });
    }
}