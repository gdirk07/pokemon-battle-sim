import { useState, useCallback } from 'react';
import { fetchBattleSprites } from '../services/pokeapi';
import type { BattleState } from '../../../shared/types/battle';

export function useBattle() {
    const [battle, setBattle] = useState<BattleState | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const attachSprites = async (battleData: BattleState): Promise<BattleState> => {
        const { pokemon1Sprites, pokemon2Sprites } = await fetchBattleSprites(
            battleData.player1.name,
            battleData.player2.name,
        );
        return {
            ...battleData,
            player1: { ...battleData.player1, sprites: pokemon1Sprites },
            player2: { ...battleData.player2, sprites: pokemon2Sprites },
        }
    }

    const generateTeams = useCallback(async() => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch ('/api/battle/start', { method: 'POST' });
            if (!res.ok) throw new Error(`Failed to start: ${res.status}`);
            const data: BattleState = await res.json();

            const dataWithSprites = await attachSprites(data);
            setBattle(dataWithSprites);
        } catch (err) {
            setError(err instanceof Error ? err.message: 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchState = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/battle/state/${id}`);
            if (!res.ok) throw new Error(`Failed to fetch state: ${res.status}`);
            const data: BattleState = await res.json();
            const dataWithSprites = await attachSprites(data);
            setBattle(dataWithSprites);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    const nextTurn = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        try {
        const res = await fetch(`/api/battle/nextturn/${id}`, { method: 'POST' });
        if (!res.ok) throw new Error(`Failed to advance turn: ${res.status}`);
        const data: BattleState = await res.json();
        setBattle(data);
        } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
        setLoading(false);
        }
    }, []);

    return { battle, loading, error, generateTeams, fetchState, nextTurn };
}