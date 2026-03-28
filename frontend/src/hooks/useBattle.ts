import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchBattleSprites } from '../services/pokeapi';
import type { BattleState, TurnLogEntry } from '../../../shared/types/battle';
import { parseBattleState } from '../services/battleParser';
import { genderForms } from '../../../shared/pokeApi/pokemonFilter';

const TURN_ENTRY_DELAY_MS = 1200;

function mergeStateWithSprites(prev: BattleState, next: BattleState): BattleState {
    return {
        ...next,
        player1: { 
            ...next.player1, 
            sprites: prev.player1.sprites,
            status: next.player1.status ?? prev.player1.status,
        },
        player2: { 
            ...next.player2, 
            sprites: prev.player2.sprites,
            status: next.player2.status ?? prev.player2.status,
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
        onComplete: () => void
    ) => {
        setDisplayedLog([]);
        setIsPlaying(true);

        const playbackState = { current: battleRef.current };

        entries.forEach((entry, i) => {
            playbackRef.current = setTimeout(() => {
                setDisplayedLog(prev => [...prev, entry.text]);

                if (entry.hp || entry.status) {
                    const prev = playbackState.current;
                    if (!prev) return;
                    
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
                    
                    playbackState.current = next;
                    battleRef.current = next;
                    setBattle(next);
                }

                if (i === entries.length - 1) {
                    battleRef.current = turnResult;
                    setBattle(turnResult);
                    setIsPlaying(false);
                    onComplete();
                }
            }, i * TURN_ENTRY_DELAY_MS);
        });
    }, []);

    const attachSprites = async (battleData: BattleState): Promise<BattleState> => {
        let pokemon1 = genderForms(battleData.player1.name, battleData.player1.gender);
        let pokemon2 = genderForms(battleData.player2.name, battleData.player2.gender);
        const { pokemon1Sprites, pokemon2Sprites } = await fetchBattleSprites(
            pokemon1,
            pokemon2,
        );
        return {
            ...battleData,
            player1: { ...battleData.player1, sprites: pokemon1Sprites },
            player2: { ...battleData.player2, sprites: pokemon2Sprites },
        };
    }

    const generateTeams = useCallback(async() => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch ('/api/battle/start', { method: 'POST' });
            if (!res.ok) throw new Error(`Failed to start: ${res.status}`);
            const data = await res.json();
            const dataWithSprites = await attachSprites(data);

            battleRef.current = dataWithSprites;
            setBattle(dataWithSprites);
            setDisplayedLog([]);
        } catch (err) {
            setError(err instanceof Error ? err.message: 'Unknown error');
        } finally {
            setIsLoading(false);
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
            playTurnLog(data.log, merged, () => setBattle(merged));
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
        nextTurn,
        fetchState,
        reset, 
    };
}