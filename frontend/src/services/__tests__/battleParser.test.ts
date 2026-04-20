import { describe, it, expect } from 'vitest'
import { parseBattleState, parsePokemon } from '../battleParser'

describe('parseCondition vis parsePokemon', () => {
    it('parses normal condition', () => {
        const pokemon = parsePokemon({
            ident: 'p1: Spheal',
            details: 'Spheal, L93, M',
            condition: '156/266',
            active: true,
            stats: {},
            moves: [],
            item: 'leftovers',
            ability: 'thickfat',
            teraType: '',
            terastallized: '',
        });
        expect(pokemon.hp).toBe(156);
        expect(pokemon.maxHp).toBe(266);
        expect(pokemon.status).toBeUndefined();
    });

    it('parses condition with status', () => {
        const pokemon = parsePokemon({
            ident: 'p1: Spheal',
            details: 'Spheal, L93, M',
            condition: '156/266 brn',
            active: true,
            stats: {},
            moves: [],
            item: 'leftovers',
            ability: 'thickfat',
            teraType: '',
            terastallized: '',
        });
        expect(pokemon.hp).toBe(156);
        expect(pokemon.maxHp).toBe(266);
        expect(pokemon.status).toBe('brn');
    });

    it('handles fainted condition 0 fnt', () => {
        const pokemon = parsePokemon({
            ident: 'p1: Spheal',
            details: 'Spheal, L93, M',
            condition: '0 fnt',
            active: false,
            stats: {},
            moves: [],
            item: '',
            ability: '',
            teraType: '',
            terastallized: '',
        }, 266)  // pass existingMaxHp
        expect(pokemon.hp).toBe(0)
        expect(pokemon.maxHp).toBe(266)  // preserved from existingMaxHp
        expect(pokemon.status).toBe('fnt')
    });

    it('parses level from details', () => {
        const pokemon = parsePokemon({
            ident: 'p1: Ampharos',
            details: 'Ampharos, L89, F',
            condition: '300/300',
            active: true,
            stats: {},
            moves: [],
            item: '',
            ability: '',
            teraType: '',
            terastallized: '',
        });
        expect(pokemon.level).toBe(89);
    });

    it('defaults level to 100 if missing', () => {
        const pokemon = parsePokemon({
            ident: 'p1: Pikachu',
            details: 'Pikachu',
            condition: '300/300',
            active: true,
            stats: {},
            moves: [],
            item: '',
            ability: '',
            teraType: '',
            terastallized: '',
        });
        expect(pokemon.level).toBe(100);
    });

    it('parses species from details', () => {
        const pokemon = parsePokemon({
            ident: 'p1: Electrode',
            details: 'Electrode-Hisui, L80',
            condition: '250/250',
            active: true,
            stats: {},
            moves: [],
            item: '',
            ability: '',
            teraType: '',
            terastallized: '',
        })
        expect(pokemon.species).toBe('Electrode-Hisui');
    });
});

describe('parseBattleState', () => {
    const mockRaw = {
        battleId: 'battle-1',
        turn: 3,
        status: 'active',
        winner: null,
        turnLog: [],
        player1: {
            ident: 'p1: Charizard',
            details: 'Charizard, L75',
            condition: '200/266',
            active: true,
            stats: {},
            moves: ['flamethrower', 'dragonclaw'],
            item: 'leftovers',
            ability: 'blaze',
            teraType: 'Fire',
            terastallized: '',
        },
        player2: {
            ident: 'p2: Blastoise',
            details: 'Blastoise, L75',
            condition: '180/251',
            active: true,
            stats: {},
            moves: ['surf', 'icebeam'],
            item: 'choicespecs',
            ability: 'torrent',
            teraType: 'Water',
            terastallized: '',
        }
    }

    it('maps battleId to id', () => {
        const state = parseBattleState(mockRaw)
        expect(state.id).toBe('battle-1')
    })

    it('falls back to existingId when id missing from response', () => {
        const raw = { ...mockRaw, battleId: undefined, id: undefined }
        const state = parseBattleState(raw, 'battle-99')
        expect(state.id).toBe('battle-99')
    })

    it('parses both players', () => {
        const state = parseBattleState(mockRaw)
        expect(state.player1.name).toBe('Charizard')
        expect(state.player2.name).toBe('Blastoise')
    })

    it('preserves existingMaxHp on faint', () => {
        const existing = parseBattleState(mockRaw)
        const fainted  = {
            ...mockRaw,
            player2: { ...mockRaw.player2, condition: '0 fnt' }
        }
        const state = parseBattleState(fainted, 'battle-1', existing)
        expect(state.player2.hp).toBe(0)
        expect(state.player2.maxHp).toBe(251)
    })
})