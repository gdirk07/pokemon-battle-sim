import { describe, it, expect } from 'vitest';
import { applyEntry, finalizeTurn } from '../battleReducer';
import type { BattleState, TurnLogEntry } from '../../../../shared/types/battle';

const mon = (name: string, hp = 100) => ({ name, species: name, level: 50, hp, maxHp: 100, terastallized: false, hasSubstitute: false });
const base = (): BattleState => ({ id: 'b', player1: mon('A'), player2: mon('B'), turn: 1, log: [], status: 'active' });
const entry = (o: Partial<TurnLogEntry>): TurnLogEntry => ({ text: 't', hp: null, status: null, substitute: null, ...o });

describe('applyEntry', () => {
    it('returns the same object for text-only entries', () => {
        const s = base();
        expect(applyEntry(s, entry({}))).toBe(s);
    });
    it('applies hp to the right side without mutating', () => {
        const s = base();
        const n = applyEntry(s, entry({ hp: { side: 'p2', hp: 40, maxHp: null } }));
        expect(n.player2.hp).toBe(40);
        expect(n.player2.maxHp).toBe(100);          // null maxHp keeps previous
        expect(n.player1.hp).toBe(100);
        expect(s.player2.hp).toBe(100);
    });
    it('applies status set and clear, and substitute on/off', () => {
        let s = applyEntry(base(), entry({ status: { side: 'p1', value: 'brn' } }));
        expect(s.player1.status).toBe('brn');
        s = applyEntry(s, entry({ status: { side: 'p1', value: null } }));
        expect(s.player1.status).toBeUndefined();
        s = applyEntry(s, entry({ substitute: { side: 'p2', active: true } }));
        expect(s.player2.hasSubstitute).toBe(true);
        s = applyEntry(s, entry({ substitute: { side: 'p2', active: false } }));
        expect(s.player2.hasSubstitute).toBe(false);
    });
});

describe('finalizeTurn', () => {
    it('takes server state but keeps client-derived substitute flag', () => {
        const played = applyEntry(base(), entry({ substitute: { side: 'p1', active: true } }));
        const auth = { ...base(), turn: 2, status: 'ended' as const, winner: 'player1' as const };
        const f = finalizeTurn(auth, played);
        expect(f.status).toBe('ended');
        expect(f.player1.hasSubstitute).toBe(true);
    });
});
