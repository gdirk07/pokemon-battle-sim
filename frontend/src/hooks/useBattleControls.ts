import { useBattleStore } from '../store/battleStore';

export function useBattleControls() {
    const { reset } = useBattleStore();

    const startBattle = async () => {
        try {
            const res = await fetch('/api/battle/start', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to start battle');
        } catch (err) {
            console.error('Start battle error:', err);
        }
    }

    // not used yet
    const stopBattle = async () => {
        try {
            await fetch('/api/battle/stop', { method: 'POST' });
            reset();
        } catch (err) {
            console.error('Stop battle error:', err);
        }
    }

    return { startBattle, stopBattle };
}