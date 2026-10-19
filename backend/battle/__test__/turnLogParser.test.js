import { describe, it, expect } from 'vitest';
const { parseTurnLog } = require('../turnLogParser');

const entry = (raw) => ({ raw, hp: null, status: null, substitute: null });

describe('parseTurnLog', () => {
    it('parses move usage', () => {
        const result = parseTurnLog([entry('|move|p1a: Charizard|Flamethrower|p2a: Blastoise')]);
        expect(result[0].text).toBe('Charizard used Flamethrower!');
    })

    it('parses damage with HP remaining', () => {
        const result = parseTurnLog([entry('|-damage|p2a: Blastoise|180/251')]);
        expect(result[0].text).toContain('Blastoise took damage');
        expect(result[0].text).toContain('%');
    })

    it('parses faint from 0 fnt condition', () => {
        const result = parseTurnLog([entry('|-damage|p2a: Blastoise|0 fnt')]);
        expect(result[0].text).toBe('Blastoise fainted!');
    })

    it('parses status condition', () => {
        const result = parseTurnLog([entry('|-status|p1a: Charizard|brn')]);
        expect(result[0].text).toContain('burned');
    })

    it('parses super effective', () => {
        const result = parseTurnLog([entry('|-supereffective|p2a: Blastoise')]);
        expect(result[0].text).toBe("It's super effective!");
    })

    it('parses critical hit', () => {
        const result = parseTurnLog([entry('|-crit|p2a: Blastoise')]);
        expect(result[0].text).toBe('Critical hit!');
    })

    it('attaches hp data to damage entry', () => {
        const result = parseTurnLog([
            { raw: '|-damage|p1a: Charizard|187/266', hp: { side: 'p1', hp: 187, maxHp: 266 }, status: null, substitute: null }
        ]);
        expect(result[0].hp).toEqual({ side: 'p1', hp: 187, maxHp: 266 });
    })

    it('attaches substitute data', () => {
        const result = parseTurnLog([
            { raw: '|-start|p1a: Charizard|Substitute', hp: null, status: null, substitute: { side: 'p1', active: true } }
        ]);
        expect(result[0].substitute).toEqual({ side: 'p1', active: true });
    })

    it('filters null entries', () => {
        const result = parseTurnLog([
            entry('|request|{"some":"json"}'),
            entry('|upkeep'),
            entry('|move|p1a: Charizard|Flamethrower|p2a: Blastoise'),
        ])
        expect(result).toHaveLength(1);
        expect(result[0].text).toContain('Flamethrower');
    })

    it('handles damage with status suffix in condition', () => {
        const result = parseTurnLog([entry('|-damage|p1a: Charizard|219/300 brn')]);
        expect(result[0].text).toContain('Charizard took damage');
        expect(result[0].text).not.toContain('brn');
    });

    it('handles crit and effective damage occuring earlier', () => {
        const result = parseTurnLog([
            entry('|move|p1a: Charizard|Flamethrower|p2a: Venasaur'), 
            entry('|-supereffective|p2a: Venasaur'),
            entry('|-crit|p2a: Venasaur'),
            { raw: '|-damage|p2a: Venasaur|40/328', hp: { side: 'p2', hp: 40, maxHp: 328 }, status: null, substitute: null}
        ]);
        expect(result[1].hp).toEqual({ side: 'p2', hp: 40, maxHp: 328 });
        expect(result[2].hp).toBeNull();
    });

    it('handles crit neutral damage occuring earlier', () => {
        const result = parseTurnLog([
            entry('|move|p1a: Charizard|Slash|p2a: Venasaur'), 
            entry('|-crit|p2a: Venasaur'),
            { raw: '|-damage|p2a: Venasaur|178/328', hp: { side: 'p2', hp: 178, maxHp: 328 }, status: null, substitute: null}
        ]);
        expect(result[1].hp).toEqual({ side: 'p2', hp: 178, maxHp: 328 });
    });
})

describe('moving HP up to the first hit-modifier line', () => {
    const dmg = (raw, side, hp, maxHp) => ({ raw, hp: { side, hp, maxHp }, status: null, substitute: null });

    it('leaves HP only on the damage line when there is no modifier', () => {
        const result = parseTurnLog([
            entry('|move|p1a: Charizard|Flamethrower|p2a: Blastoise'),
            dmg('|-damage|p2a: Blastoise|200/251', 'p2', 200, 251),
        ]);
        expect(result[0].hp).toBeNull();
        expect(result[1].hp).toEqual({ side: 'p2', hp: 200, maxHp: 251 });
    });

    it('does not take damage from a different Pokemon after a hit on a Substitute', () => {
        const result = parseTurnLog([
            entry('|move|p1a: Charizard|Flamethrower|p2a: Venusaur'),
            entry('|-supereffective|p2a: Venusaur'),
            entry('|-activate|p2a: Venusaur|Substitute|[damage]'),
            dmg('|-damage|p1a: Charizard|250/297|[from] item: Life Orb', 'p1', 250, 297),
        ]);
        expect(result[1].text).toBe("It's super effective!");
        expect(result[1].hp).toBeNull();
    });

    it('does not take damage from the next move', () => {
        const result = parseTurnLog([
            entry('|move|p1a: Charizard|Flamethrower|p2a: Venusaur'),
            entry('|-supereffective|p2a: Venusaur'),
            entry('|-activate|p2a: Venusaur|Substitute|[damage]'),
            entry('|move|p2a: Venusaur|Giga Drain|p1a: Charizard'),
            entry('|-resisted|p1a: Charizard'),
            dmg('|-damage|p1a: Charizard|260/297', 'p1', 260, 297),
        ]);
        expect(result[1].hp).toBeNull();
        expect(result[4].hp).toEqual({ side: 'p1', hp: 260, maxHp: 297 });
    });

    it('does not take residual damage on the same target', () => {
        const result = parseTurnLog([
            entry('|move|p1a: Charizard|Flamethrower|p2a: Venusaur'),
            entry('|-crit|p2a: Venusaur'),
            entry('|-activate|p2a: Venusaur|Substitute|[damage]'),
            dmg('|-damage|p2a: Venusaur|280/328 psn|[from] psn', 'p2', 280, 328),
        ]);
        expect(result[1].hp).toBeNull();
    });

    it('keeps indexes aligned when an earlier line is filtered out', () => {
        const result = parseTurnLog([
            entry('|-heal|p1a: Charizard|297/297|[silent]'),
            entry('|move|p1a: Charizard|Flamethrower|p2a: Venusaur'),
            entry('|-crit|p2a: Venusaur'),
            dmg('|-damage|p2a: Venusaur|100/328', 'p2', 100, 328),
        ]);
        expect(result).toHaveLength(3);
        expect(result[1].text).toBe('Critical hit!');
        expect(result[1].hp).toEqual({ side: 'p2', hp: 100, maxHp: 328 });
    });

    it('moves faint HP up but leaves the faint text on the damage line', () => {
        const result = parseTurnLog([
            entry('|move|p1a: Charizard|Flamethrower|p2a: Venusaur'),
            entry('|-supereffective|p2a: Venusaur'),
            dmg('|-damage|p2a: Venusaur|0 fnt', 'p2', 0, null),
        ]);
        expect(result[1].hp).toEqual({ side: 'p2', hp: 0, maxHp: null });
        expect(result[2].text).toBe('Venusaur fainted!');
    });

    it('pairs each move in a turn with its own damage', () => {
        const result = parseTurnLog([
            entry('|move|p1a: Charizard|Flamethrower|p2a: Venusaur'),
            entry('|-supereffective|p2a: Venusaur'),
            dmg('|-damage|p2a: Venusaur|50/328', 'p2', 50, 328),
            entry('|move|p2a: Venusaur|Giga Drain|p1a: Charizard'),
            entry('|-crit|p1a: Charizard'),
            entry('|-resisted|p1a: Charizard'),
            dmg('|-damage|p1a: Charizard|240/297', 'p1', 240, 297),
        ]);
        expect(result[1].hp).toEqual({ side: 'p2', hp: 50, maxHp: 328 });
        expect(result[4].hp).toEqual({ side: 'p1', hp: 240, maxHp: 297 });
        expect(result[5].hp).toBeNull();
    });
});