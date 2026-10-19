import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    BattleState, Bets, ClientMessage, Command, Mode, Phase, ServerMessage, TurnLogEntry,
} from '../../../shared/types/battle';
import { parseBattleState } from '../services/battleParser';
import { getSprites } from '../services/sprites';
import { applyEntry, finalizeTurn, mergeStateWithSprites } from '../services/battleReducer';

// The overlay owns presentation time. Keep in sync with backend TURN_ENTRY_MS (only used for its stuck-overlay watchdog).
// e2e tests shorten playback by setting window.__PB_TURN_ENTRY_MS before the page loads.
export const TURN_ENTRY_DELAY_MS: number =
    (window as Window & { __PB_TURN_ENTRY_MS?: number }).__PB_TURN_ENTRY_MS ?? 1200;

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 5000;

function wsUrl() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}/ws`;
}

function withSprites(state: BattleState): BattleState {
    return {
        ...state,
        player1: { ...state.player1, sprites: getSprites(state.player1.species) },
        player2: { ...state.player2, sprites: getSprites(state.player2.species) },
    };
}

/**
 * Server-driven battle view.
 *  - Server sends: snapshot (authoritative "what is on screen"), phase, bets, turn (one batch per turn).
 *  - Overlay plays a batch at its own pace, then sends `ack`. The server will not advance, and will not
 *    tell Streamer.bot anything about the turn, until it has that ack.
 */
export function useBattleSocket() {
    const [mode, setMode] = useState<Mode | null>(null);
    const [phase, setPhase] = useState<Phase>('idle');
    const [deadline, setDeadline] = useState<number | null>(null);
    const [bets, setBets] = useState<Bets>({ p1Total: 0, p2Total: 0 });
    const [battle, setBattle] = useState<BattleState | null>(null);
    const [displayedLog, setDisplayedLog] = useState<string[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [connected, setConnected] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const battleRef = useRef<BattleState | null>(null);
    const timersRef = useRef<number[]>([]);

    const send = useCallback((msg: ClientMessage) => {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    }, []);

    const command = useCallback((name: Command) => {
        setIsLoading(true);
        send({ type: 'command', name });
    }, [send]);

    useEffect(() => {
        let disposed = false;
        let retry: number | undefined;
        let backoff = RECONNECT_MIN_MS;

        const setBattleBoth = (b: BattleState | null) => {
            battleRef.current = b;
            setBattle(b);
        };

        const clearTimers = () => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        };

        // Replays one server batch, then acks it. Cancels any playback already in progress.
        const playTurn = (seq: number, entries: TurnLogEntry[], authoritative: BattleState, start: BattleState) => {
            clearTimers();
            setDisplayedLog([]);
            setIsPlaying(true);
            const startedAt = performance.now();
            let current: BattleState = { ...start, player1: { ...start.player1, hasSubstitute: start.player1.hasSubstitute ?? false }, player2: { ...start.player2, hasSubstitute: start.player2.hasSubstitute ?? false } };

            const finish = () => {
                const done = finalizeTurn(authoritative, current);
                setBattleBoth(done);
                setIsPlaying(false);
                send({ type: 'ack', seq, durationMs: Math.round(performance.now() - startedAt) });
            };

            if (entries.length === 0) { finish(); return; }

            entries.forEach((entry, i) => {
                timersRef.current.push(window.setTimeout(() => {
                    setDisplayedLog(prev => [...prev, entry.text]);
                    const next = applyEntry(current, entry);
                    if (next !== current) { current = next; setBattleBoth(next); }
                    if (i === entries.length - 1) finish();
                }, i * TURN_ENTRY_DELAY_MS));
            });
        };

        const handle = (msg: ServerMessage) => {
            switch (msg.type) {
                case 'snapshot': {
                    // Authoritative "what viewers should see right now". Drops any playback in flight;
                    // an unacked turn is re-sent by the server right after this.
                    clearTimers();
                    setIsPlaying(false);
                    setIsLoading(false);
                    setDisplayedLog([]);
                    setMode(msg.mode);
                    setPhase(msg.phase);
                    setDeadline(msg.deadline);
                    setBets(msg.bets);
                    setBattleBoth(msg.state ? withSprites(parseBattleState(msg.state, msg.battleId ?? undefined)) : null);
                    break;
                }
                case 'phase': {
                    setPhase(msg.phase);
                    setDeadline(msg.deadline);
                    setIsLoading(false);
                    if (msg.state && battleRef.current) {
                        setBattleBoth(mergeStateWithSprites(battleRef.current, parseBattleState(msg.state, msg.state.id, battleRef.current)));
                    }
                    break;
                }
                case 'bets':
                    setBets({ p1Total: msg.p1Total, p2Total: msg.p2Total });
                    break;
                case 'turn': {
                    const current = battleRef.current;
                    if (!current) return;          // no snapshot yet; the server will resend on reconnect
                    setIsLoading(false);
                    const data = parseBattleState(msg.state, msg.battleId, current);
                    const merged = mergeStateWithSprites(current, data);
                    playTurn(msg.seq, data.log, merged, current);
                    break;
                }
            }
        };

        const connect = () => {
            if (disposed) return;
            const ws = new WebSocket(wsUrl());
            wsRef.current = ws;

            ws.onopen = () => { backoff = RECONNECT_MIN_MS; setConnected(true); };
            ws.onmessage = (ev) => {
                try { handle(JSON.parse(ev.data as string) as ServerMessage); }
                catch (err) { console.error('bad server message', err); }
            };
            ws.onclose = () => {
                setConnected(false);
                if (disposed) return;
                retry = window.setTimeout(connect, backoff);
                backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
            };
            ws.onerror = () => ws.close();
        };

        connect();
        return () => {
            disposed = true;
            clearTimeout(retry);
            clearTimers();
            wsRef.current?.close();
        };
    }, [send]);

    return { mode, phase, deadline, bets, battle, displayedLog, isPlaying, isLoading, connected, command };
}
