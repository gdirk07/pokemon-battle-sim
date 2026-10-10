import type { BattleState, TurnLogEntry } from '../../../shared/types/battle';

/**
 * Pure helpers for replaying a server-sent turn. No timers, no React.
 * `applyEntry` returns the SAME object when the entry carries no state change, so callers can skip re-renders.
 */
export function applyEntry(prev: BattleState, entry: TurnLogEntry): BattleState {
    if (!entry.hp && !entry.status && !entry.substitute) return prev;

    let next = prev;

    if (entry.hp) {
        const key = entry.hp.side === 'p1' ? 'player1' : 'player2';
        next = {
            ...next,
            [key]: {
                ...next[key],
                hp: entry.hp.hp,
                maxHp: entry.hp.maxHp ?? next[key].maxHp,
            },
        };
    }

    if (entry.status) {
        const key = entry.status.side === 'p1' ? 'player1' : 'player2';
        next = { ...next, [key]: { ...next[key], status: entry.status.value ?? undefined } };
    }

    if (entry.substitute) {
        const key = entry.substitute.side === 'p1' ? 'player1' : 'player2';
        next = { ...next, [key]: { ...next[key], hasSubstitute: entry.substitute.active } };
    }

    return next;
}

// Carry client-only fields (sprites, substitute flag) across a server state update.
export function mergeStateWithSprites(prev: BattleState, next: BattleState): BattleState {
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

// Server state is authoritative once playback finishes; only the substitute flag is client-derived.
export function finalizeTurn(authoritative: BattleState, played: BattleState): BattleState {
    return {
        ...authoritative,
        player1: { ...authoritative.player1, hasSubstitute: played.player1.hasSubstitute ?? false },
        player2: { ...authoritative.player2, hasSubstitute: played.player2.hasSubstitute ?? false },
    };
}
