import { describe, it, expect } from 'vitest';
import { toID, toSpriteID } from '../pokemon';

describe('toID', () => {
    it('lowercases and strips non-alphanumeric', () => {
        expect(toID('Ampharos')).toBe('ampharos');
        expect(toID('Alcremie-Rainbowswirl')).toBe('alcremierainbowswirl');
        expect(toID('Arceus-Ice')).toBe('arceusice');
        expect(toID('Ho-oh')).toBe('hooh');
        expect(toID('Iron Treads')).toBe('irontreads');
        expect(toID('Mr.. Mime')).toBe('mrmime');
    });
});

describe('toSpriteID', () => {
    it('preserves hyphens and converts spaces to hyphens', () => {
        expect(toSpriteID('Rotom-Frost')).toBe('rotom-frost')
        expect(toSpriteID('Mr. Mime')).toBe('mr-mime')
        expect(toSpriteID('Iron Treads')).toBe('iron-treads')
        expect(toSpriteID('Gouging Fire')).toBe('gouging-fire')
    })

    it('removes apostrophes and dots', () => {
        expect(toSpriteID("Farfetch'd")).toBe('farfetchd')
        expect(toSpriteID('Mr. Mime')).toBe('mr-mime')
    })
})