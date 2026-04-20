import { describe, it, expect } from 'vitest'
import { getSprites } from '../sprites'
import { SPRITE_OVERRIDES } from '../sprites';

describe('getSprites', () => {
    it('builds correct URLs for standard pokemon', () => {
        const sprites = getSprites('Charizard')
        expect(sprites.officialArtwork).toContain('charizard')
        expect(sprites.frontDefault).toContain('charizard')
        expect(sprites.backDefault).toContain('charizard')
    });

    it('applies sprite override for regional forms', () => {
        const sprites = getSprites('Electrode-Hisui')
        expect(sprites.officialArtwork).toContain('electrode-hisui')
    });

    it('applies sprite override for Vivillon forms', () => {
        const sprites = getSprites('Vivillon-Garden')
        expect(sprites.officialArtwork).toContain('vivillon-garden')
    });

    it('applies sprite override for Sinistcha-Masterpiece', () => {
        const sprites = getSprites('Sinistcha-Masterpiece')
        expect(sprites.officialArtwork).toContain('sinistcha-masterpiece')
    });

    it('handles paradox pokemon', () => {
        const sprites = getSprites('Gouging Fire')
        expect(sprites.officialArtwork).toContain('gougingfire')
    });
});

describe('SPRITE_OVERRIDES', () => {
    it('contains all Vivillon forms', () => {
        expect(SPRITE_OVERRIDES['vivillongarden']).toBe('vivillon-garden')
        expect(SPRITE_OVERRIDES['vivillonpokeball']).toBe('vivillon-pokeball')
    });

    it('contains Sinistcha masterpiece', () => {
        expect(SPRITE_OVERRIDES['sinistchamasterpiece']).toBe('sinistcha-masterpiece')
    });
})