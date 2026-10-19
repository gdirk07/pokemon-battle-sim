import { test as base, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { FakeStreamerBot } from './helpers/FakeStreamerBot';
import { APP_PORT, SB_PORT, TEST_BETTING_MS, TEST_TURN_ENTRY_MS } from './ports';

type TestFixtures = {
    streamerbot: FakeStreamerBot;
};
type WorkerFixtures = { fakeSb: FakeStreamerBot; appUrl: string };

const BACKEND_ENTRY = path.resolve(__dirname, '../backend/index.js');

function startBackend(port: number, sbPort: number) {
    // Run node directly (no npm / shell in between) with an IPC channel: the backend exits on 'disconnect',
    // so it dies with this worker even if the worker is killed without running teardown.
    const proc = spawn(process.execPath, [BACKEND_ENTRY], {
        env: {
            ...process.env,
            PORT: String(port),
            PB_MODE: 'streamerbot',
            STREAMERBOT_URL: `ws://localhost:${sbPort}`,
            STREAMERBOT_PASSWORD: '',
            STREAMERBOT_RETRY_MS: '250',
            BETTING_MS: String(TEST_BETTING_MS),
            TURN_ENTRY_MS: String(TEST_TURN_ENTRY_MS),
            ACK_SLACK_MS: '5000',
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        windowsHide: true,
    });

    // Output must be drained or the child blocks once the pipe buffer fills. Keep the tail for failure reports.
    const tail: string[] = [];
    const keep = (chunk: Buffer) => {
        tail.push(...chunk.toString().split(/\r?\n/).filter(Boolean));
        if (tail.length > 200) tail.splice(0, tail.length - 200);
    };
    proc.stdout!.on('data', keep);
    proc.stderr!.on('data', keep);

    const exited = new Promise<never>((_, reject) => {
        proc.once('exit', (code) => reject(new Error(`backend on :${port} exited (code ${code}):\n${tail.join('\n')}`)));
    });
    exited.catch(() => {});

    return { proc, exited, logs: () => tail.join('\n') };
}

async function stopBackend(proc: ChildProcess) {
    if (proc.exitCode !== null || proc.signalCode !== null) return;
    const gone = new Promise<void>((resolve) => proc.once('exit', () => resolve()));
    proc.disconnect?.();                         // graceful: backend closes its server on 'disconnect'
    const timer = setTimeout(() => proc.kill('SIGKILL'), 3000);
    await gone;
    clearTimeout(timer);
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
    fakeSb: [async ({}, use, workerInfo) => {
        const sb = new FakeStreamerBot(SB_PORT + workerInfo.workerIndex);
        await sb.start();
        try {
            await use(sb);
        } finally {
            await sb.stop();
        }
    }, { scope: 'worker' }],

    appUrl: [async ({ fakeSb }, use, workerInfo) => {
        const port = APP_PORT + workerInfo.workerIndex;
        const backend = startBackend(port, SB_PORT + workerInfo.workerIndex);
        try {
            // Subscribed to the fake Streamer.bot implies the HTTP server is already listening.
            await Promise.race([fakeSb.waitForBackend(15_000), backend.exited]);
            await use(`http://localhost:${port}`);
        } finally {
            await stopBackend(backend.proc);
        }
    }, { scope: 'worker' }],

    // The backend serves the built overlay itself, so page.goto('/') and request.get('/api/...') hit this worker's stack.
    baseURL: async ({ appUrl }, use) => use(appUrl),

    page: async ({ page }, use) => {
        await page.addInitScript((ms) => { (window as any).__PB_TURN_ENTRY_MS = ms; }, TEST_TURN_ENTRY_MS);
        await use(page);
    },

    streamerbot: async ({ fakeSb, request }, use) => {
        const res = await request.post('/api/command/reset');
        expect(res.ok()).toBeTruthy();
        fakeSb.clear();
        await use(fakeSb);
    },
});

export async function waitForOverlay(request: import('@playwright/test').APIRequestContext, count = 1) {
    await expect.poll(async () => (await (await request.get('/api/status')).json()).overlays).toBeGreaterThanOrEqual(count);
}

export { expect };
