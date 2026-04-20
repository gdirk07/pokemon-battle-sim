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
})