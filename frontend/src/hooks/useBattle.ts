import { useState, useCallback, useRef, useEffect } from 'react';
import { getSprites } from '../services/sprites';
import type { BattleState, TurnLogEntry } from '../../../shared/types/battle';
import { parseBattleState } from '../services/battleParser';

const TURN_ENTRY_DELAY_MS = 1200;

function mergeStateWithSprites(prev: BattleState, next: BattleState): BattleState {
    return {
        ...next,
        player1: { 
            ...next.player1, 
            sprites: prev.player1.sprites,
            status: next.player1.status ?? prev.player1.status,
            hasSubstitute: prev.player1.hasSubstitute ?? false,
        },
        player2: { 
            ...next.player2, 
            sprites: prev.player2.sprites,
            status: next.player2.status ?? prev.player2.status,
            hasSubstitute: prev.player2.hasSubstitute ?? false,
        },
    };
}

export function useBattle() {
    const [battle, setBattle] = useState<BattleState | null>(null);
    const [displayedLog, setDisplayedLog] = useState<string[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const battleRef = useRef<BattleState | null>(null)
    useEffect(() => {
        battleRef.current = battle;
    }, [battle]);

    const playbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const playTurnLog = useCallback((
        entries: TurnLogEntry[],
        turnResult: BattleState,
        initialState: BattleState,
    ) => {
        setDisplayedLog([]);
        setIsPlaying(true);

        const playbackState = { 
            current: {
                ...initialState,
                player1: { ...initialState.player1, hasSubstitute: initialState.player1.hasSubstitute ?? false },
                player2: { ...initialState.player2, hasSubstitute: initialState.player2.hasSubstitute ?? false }, 
            }
        };

        entries.forEach((entry, i) => {
            playbackRef.current = setTimeout(() => {
                console.log(`entry ${i}/${entries.length - 1}:`, JSON.stringify(entry))
                try {
                    setDisplayedLog(prev => [...prev, entry.text]);

                    if (entry.hp || entry.status || entry.substitute) {
                        const prev = playbackState.current;
                        if (!prev) {
                            console.error('playbackState.current is null/undefined at entry', i);
                            return
                        }
                        
                        let next = { ...prev };
                        if (entry.hp) {
                            const isP1 = entry.hp.side === 'p1';

                            next = {
                                ...prev,
                                player1: isP1 ? {
                                    ...prev.player1,
                                    hp: entry.hp.hp,
                                    maxHp: entry.hp.maxHp ?? prev.player1.maxHp,
                                } : prev.player1,
                                player2: !isP1 ? {
                                    ...prev.player2,
                                    hp: entry.hp.hp,
                                    maxHp: entry.hp.maxHp ?? prev.player2.maxHp,
                                } : prev.player2,
                            }
                        }

                        if (entry.status) {
                            const isP1 = entry.status.side === 'p1';
                            next = {
                                ...next,
                                player1: isP1 ? { ...next.player1, status: entry.status.value ?? undefined } : next.player1,
                                player2: !isP1 ? { ...next.player2, status: entry.status.value ?? undefined } : next.player2,
                            }
                        }
                        
                        if (entry.substitute) {
                            const isP1 = entry.substitute.side === 'p1';
                            next = {
                                ...next,
                                player1: isP1 ? {
                                    ...next.player1,
                                    hasSubstitute: entry.substitute.active
                                } : next.player1,
                                player2: !isP1? {
                                    ...next.player2,
                                    hasSubstitute: entry.substitute.active
                                } : next.player2,
                            }
                        }

                        playbackState.current = next;
                        battleRef.current = next;
                        setBattle(next);
                    }

                    if (i === entries.length - 1) {
                        const current = playbackState.current;
                        const finalState: BattleState = {
                            ...turnResult,
                            player1: {
                                ...turnResult.player1,
                                hasSubstitute: current?.player1.hasSubstitute ?? false,
                            },
                            player2: {
                                ...turnResult.player2,
                                hasSubstitute: current?.player2.hasSubstitute ?? false,
                            },
                        }

                        battleRef.current = finalState;
                        setBattle(finalState);
                        setIsPlaying(false);
                    }
                } catch (err) {
                    console.error(`CRASH at entry ${i}:`, JSON.stringify(entry), err)
                }
            }, i * TURN_ENTRY_DELAY_MS);
        });
    }, []);

    const generateTeams = useCallback(async() => {
        setIsLoading(true);
        setError(null);
        try {
            const startRes = await fetch ('/api/battle/start', { method: 'POST' });
            if (!startRes.ok) throw new Error(`Failed to start: ${startRes.status}`);
            const { id } = await startRes.json();

            await new Promise(resolve => setTimeout(resolve, 500));

            const stateRes = await fetch(`/api/battle/state/${id}`);
            if (!stateRes.ok) throw new Error(`Failed to fetch state: ${stateRes.status}`);
            const raw = await stateRes.json();
            const data = parseBattleState(raw, id);
            const dataWithSprites = {
                ...data,
                player1: { ...data.player1, sprites: getSprites(data.player1.species) },
                player2: { ...data.player2, sprites: getSprites(data.player2.species) },
            }
            battleRef.current = dataWithSprites;
            setBattle(dataWithSprites);
            setDisplayedLog([]);
        } catch (err) {
            setError(err instanceof Error ? err.message: 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const beginBattle = useCallback(async() => {
        const current = battleRef.current;
        if (!current) return;
        try {
            await fetch(`/api/battle/begin/${current.id}`, { method: 'POST' });
        } catch (err) {
            console.error('Failed to begin battle:', err);
        }
    }, []);

    const nextTurn = useCallback(async() => {
        const current = battleRef.current;
        if (!current || isPlaying) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/battle/nextturn/${current.id}`, { method: 'POST' });
            if (!res.ok) throw new Error(`Failed to advance turn: ${res.status}`);
            const raw = await res.json();
            const data = parseBattleState(raw, current.id, current);
            const merged = mergeStateWithSprites(current, data);
            setIsLoading(false);
            playTurnLog(data.log, merged, current);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setIsLoading(false);
        }
    }, [isPlaying, playTurnLog]);

    const fetchState = useCallback(async (id: string) => {
        const current = battleRef.current;
        if (!current) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/battle/state/${id}`);
            if (!res.ok) throw new Error(`Failed to fetch state: ${res.status}`);
            const raw = await res.json();
            const data = parseBattleState(raw, current.id);
            
            const merged = mergeStateWithSprites(current, data);
            battleRef.current = merged;

            setBattle(merged);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [battle]);

    const reset = useCallback(() => {
        battleRef.current = null;
        setBattle(null);
        setDisplayedLog([]);
        setIsPlaying(false);
        setIsLoading(false);
        setError(null);
    }, [])

    return { 
        battle, 
        displayedLog,
        isPlaying,
        isLoading, 
        error, 
        generateTeams, 
        beginBattle,
        nextTurn,
        fetchState,
        reset, 
    };
}