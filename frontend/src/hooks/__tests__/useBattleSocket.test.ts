import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBattleSocket, TURN_ENTRY_DELAY_MS } from '../useBattleSocket';

class FakeWS {
    static last: FakeWS;
    static OPEN = 1;
    readyState = 1;
    sent: any[] = [];
    onopen: any; onmessage: any; onclose: any; onerror: any;
    constructor() { FakeWS.last = this; setTimeout(() => this.onopen?.(), 0); }
    send(d: string) { this.sent.push(JSON.parse(d)); }
    close() { this.readyState = 3; this.onclose?.(); }
    serverSays(m: unknown) { this.onmessage?.({ data: JSON.stringify(m) }); }
}

const rawMon = (id: string, hp: number) => ({
    ident: `${id}: Mon${id}`, details: `Pikachu, L50`, condition: `${hp}/100`, moves: ['thunderbolt'], stats: {}, item: 'x', ability: 'y',
});
const rawState = (hp1: number, hp2: number, extra: any = {}) => ({
    id: 'battle-1', turn: 0, status: 'active', winner: null, turnLog: [], player1: rawMon('p1', hp1), player2: rawMon('p2', hp2), ...extra,
});
const e = (text: string, hp: any = null) => ({ text, hp, status: null, substitute: null });

describe('useBattleSocket', () => {
    beforeEach(() => { vi.useFakeTimers(); (globalThis as any).WebSocket = FakeWS; });
    afterEach(() => { vi.useRealTimers(); });

    async function boot() {
        const hook = renderHook(() => useBattleSocket());
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        const ws = FakeWS.last;
        act(() => ws.serverSays({ type: 'snapshot', mode: 'manual', phase: 'fighting', deadline: null, bets: { p1Total: 0, p2Total: 0 }, seq: 0, battleId: 'battle-1', state: rawState(100, 100) }));
        return { hook, ws };
    }

    it('plays a turn at its own pace and acks only after the last entry', async () => {
        const { hook, ws } = await boot();
        act(() => ws.serverSays({ type: 'turn', seq: 7, battleId: 'battle-1', state: rawState(100, 40, { turn: 1, turnLog: [e('A used X!'), e('B took damage', { side: 'p2', hp: 40, maxHp: 100 }), e('end')] }) }));

        expect(hook.result.current.isPlaying).toBe(true);
        expect(ws.sent.filter(m => m.type === 'ack')).toHaveLength(0);

        await act(async () => { await vi.advanceTimersByTimeAsync(TURN_ENTRY_DELAY_MS); });
        expect(hook.result.current.displayedLog).toEqual(['A used X!', 'B took damage']);
        expect(hook.result.current.battle?.player2.hp).toBe(40);   // hp bar moves with its log line
        expect(ws.sent.filter(m => m.type === 'ack')).toHaveLength(0);

        await act(async () => { await vi.advanceTimersByTimeAsync(TURN_ENTRY_DELAY_MS); });
        expect(hook.result.current.isPlaying).toBe(false);
        const acks = ws.sent.filter(m => m.type === 'ack');
        expect(acks).toHaveLength(1);
        expect(acks[0]).toMatchObject({ type: 'ack', seq: 7 });
    });

    it('a snapshot cancels in-flight playback and nothing is acked for the abandoned turn', async () => {
        const { hook, ws } = await boot();
        act(() => ws.serverSays({ type: 'turn', seq: 1, battleId: 'battle-1', state: rawState(100, 40, { turn: 1, turnLog: [e('a'), e('b'), e('c')] }) }));
        await act(async () => { await vi.advanceTimersByTimeAsync(TURN_ENTRY_DELAY_MS); });
        act(() => ws.serverSays({ type: 'snapshot', phase: 'fighting', deadline: null, bets: { p1Total: 0, p2Total: 0 }, seq: 0, battleId: 'battle-1', state: rawState(100, 100) }));
        await act(async () => { await vi.advanceTimersByTimeAsync(TURN_ENTRY_DELAY_MS * 5); });
        expect(hook.result.current.isPlaying).toBe(false);
        expect(ws.sent.filter(m => m.type === 'ack')).toHaveLength(0);
        expect(hook.result.current.displayedLog).toEqual([]);
    });

    it('acks an empty batch immediately and reflects bets/phase messages', async () => {
        const { hook, ws } = await boot();
        act(() => ws.serverSays({ type: 'bets', p1Total: 9, p2Total: 3 }));
        expect(hook.result.current.bets).toEqual({ p1Total: 9, p2Total: 3 });
        act(() => ws.serverSays({ type: 'turn', seq: 2, battleId: 'battle-1', state: rawState(100, 100, { turn: 1, turnLog: [] }) }));
        expect(ws.sent.filter(m => m.type === 'ack')).toHaveLength(1);
        act(() => ws.serverSays({ type: 'phase', phase: 'victory', deadline: null }));
        expect(hook.result.current.phase).toBe('victory');
    });

    it('learns the mode from the backend snapshot (unknown until the first one arrives)', async () => {
        const hook = renderHook(() => useBattleSocket());
        expect(hook.result.current.mode).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        act(() => FakeWS.last.serverSays({ type: 'snapshot', mode: 'streamerbot', phase: 'idle', deadline: null, bets: { p1Total: 0, p2Total: 0 }, seq: 0, battleId: null, state: null }));
        expect(hook.result.current.mode).toBe('streamerbot');
    });

    it('sends commands and reconnects with backoff after a drop', async () => {
        const { hook, ws } = await boot();
        act(() => hook.result.current.command('next'));
        expect(ws.sent).toContainEqual({ type: 'command', name: 'next' });
        const first = FakeWS.last;
        act(() => ws.close());
        expect(hook.result.current.connected).toBe(false);
        await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
        expect(FakeWS.last).not.toBe(first);
    });
});
