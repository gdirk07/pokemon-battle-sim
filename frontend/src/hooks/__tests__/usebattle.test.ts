import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBattle } from '../useBattle';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

vi.mock('../../services/sprites', () => ({
    getSprites: () => ({
        officialArtwork: '/sprites/home/spheal.png',
        frontDefault:    '/sprites/ani/spheal.gif',
        backDefault:     '/sprites/ani-back/spheal.gif',
    })
}));

const mockPlayer = (name: string) => ({
    ident: `p1: ${name}`,
    details: `${name}, L75`,
    condition: '266/266',
    active: true,
    stats: { atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    moves: ['icebeam', 'rollout', 'rest', 'earthquake'],
    item: 'leftovers',
    ability: 'blaze',
    teraType: 'Ice',
    terastallized: '',
    hasSubstitute: false,
});

const mockBattleResponse = (overrides = {}) => ({
    battleId: 'battle-1',
    turn: 0,
    status: 'active',
    winner: null,
    turnLog: [],
    player1: mockPlayer('Spheal'),
    player2: mockPlayer('Blastoise'),
    ...overrides,
});

beforeEach(() => {
    mockFetch.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useBattle - generateTeams', () => {
    it('sets battle state after successful fetch', async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async() => ({ battleId: 'battle-1' })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async() => mockBattleResponse()
            });
        const { result } = renderHook(() => useBattle());

        await act(async () => {
            await result.current.generateTeams();
        });

        expect(result.current.battle).not.toBeNull();
        expect(result.current.battle?.id).toBe('battle-1');
        expect(result.current.battle?.player1.name).toBe('Spheal');
        expect(result.current.battle?.player2.name).toBe('Blastoise');
    });

    it('sets error on failed fetch', async() => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
        const { result } = renderHook(() => useBattle());

        await act(async () => {
            await result.current.generateTeams();
        });

        expect(result.current.error).not.toBeNull();
        expect(result.current.battle).toBeNull();
    });

    it('sets isLoading during fetch', async() => {
        let resolve: (v: any) => void;
        const pending = new Promise(r => resolve = r);
        mockFetch.mockReturnValueOnce(pending);

        const { result } = renderHook(() => useBattle());

        act(() => {
            result.current.generateTeams();
        });

        expect(result.current.isLoading).toBe(true);

        await act(async() => {
            resolve!({ ok: false, status: 500 });
            await pending.catch(() => {});
        });
    });

    it('attaches sprites to pokemon', async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async() => ({ battleId: 'battle-1' })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async() => mockBattleResponse()
            });

        const { result } = renderHook(() => useBattle());

        await act(async () => {
            await result.current.generateTeams();
        });

        expect(result.current.battle?.player1.sprites).toBeDefined();
        expect(result.current.battle?.player1.sprites?.officialArtwork).toContain('spheal');
    });
});

describe('useBattle — nextTurn', () => {
    it('does nothing if no battle', async () => {
        const { result } = renderHook(() => useBattle());

        await act(async () => {
            await result.current.nextTurn();
        })

        expect(mockFetch).not.toHaveBeenCalled();
    })

    it('does nothing if isPlaying', async () => {
        // Set up a battle first
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ battleId: 'battle-1' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockBattleResponse() });
        const { result } = renderHook(() => useBattle());

        await act(async () => {
            await result.current.generateTeams();
        })

        mockFetch.mockReset();
    });

    it('fetches next turn and updates battle state', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ battleId: 'battle-1' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockBattleResponse() })

        const { result } = renderHook(() => useBattle())

        await act(async () => {
            await result.current.generateTeams()
        })

        const turnResponse = mockBattleResponse({
            turn:    1,
            turnLog: [
                { text: 'Charizard used Flamethrower!', hp: null, status: null, substitute: null },
                { text: 'Blastoise took damage! (72% HP remaining)', hp: { side: 'p2', hp: 180, maxHp: 251 }, status: null, substitute: null }
            ],
            player2: { ...mockPlayer('Blastoise'), condition: '180/251' }
        })

        mockFetch.mockResolvedValueOnce({
            ok:   true,
            json: async () => turnResponse
        })
        vi.useFakeTimers();
        await act(async () => {
            await result.current.nextTurn()
        })

        // isPlaying should be true while log plays out
        expect(result.current.isPlaying).toBe(true)

        // Advance timers to complete log playback
        await act(async () => {
            vi.runAllTimers()
        })

        expect(result.current.isPlaying).toBe(false)
        expect(result.current.battle?.turn).toBe(1)
    })

    it('preserves sprites after turn', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ battleId: 'battle-1' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockBattleResponse() })

        const { result } = renderHook(() => useBattle())

        await act(async () => {
            await result.current.generateTeams()
        })

        const originalSprites = result.current.battle?.player1.sprites

        mockFetch.mockResolvedValueOnce({
            ok:   true,
            json: async () => mockBattleResponse({ turn: 1, turnLog: [] })
        })
        vi.useFakeTimers();
        await act(async () => {
            await result.current.nextTurn()
            vi.runAllTimers()
        })

        expect(result.current.battle?.player1.sprites).toEqual(originalSprites)
    })
})

describe('useBattle — reset', () => {
    it('clears all state', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ battleId: 'battle-1' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockBattleResponse() })

        const { result } = renderHook(() => useBattle())

        await act(async () => {
            await result.current.generateTeams()
        })

        expect(result.current.battle).not.toBeNull()

        act(() => {
            result.current.reset()
        })

        expect(result.current.battle).toBeNull()
        expect(result.current.displayedLog).toHaveLength(0)
        expect(result.current.isPlaying).toBe(false)
        expect(result.current.error).toBeNull()
    })
})

describe('useBattle — hasSubstitute', () => {
    it('updates hasSubstitute during turn playback', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ battleId: 'battle-1' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockBattleResponse() })

        const { result } = renderHook(() => useBattle())

        await act(async () => {
            await result.current.generateTeams()
        })

        mockFetch.mockResolvedValueOnce({
            ok:   true,
            json: async () => mockBattleResponse({
                turn:    1,
                turnLog: [
                    { text: 'Charizard used Substitute!', hp: null, status: null, substitute: { side: 'p1', active: true } },
                ]
            })
        })
        vi.useFakeTimers();
        await act(async () => {
            await result.current.nextTurn()
        })

        // After first log entry fires
        await act(async () => {
            vi.advanceTimersByTime(1200)
        })

        console.log("player1: ", result.current.battle?.player1);
        expect(result.current.battle?.player1.hasSubstitute).toBe(true)
    })

    it('preserves hasSubstitute at end of turn', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ battleId: 'battle-1' }) })
            .mockResolvedValueOnce({ ok: true, json: async () => mockBattleResponse() })

        const { result } = renderHook(() => useBattle())

        await act(async () => {
            await result.current.generateTeams()
        })

        mockFetch.mockResolvedValueOnce({
            ok:   true,
            json: async () => mockBattleResponse({
                turn:    1,
                turnLog: [
                    { text: 'Charizard used Substitute!', hp: null, status: null, substitute: { side: 'p1', active: true } },
                ]
            })
        })

        vi.useFakeTimers();
        await act(async () => {
            await result.current.nextTurn()
            vi.runAllTimers()
        })

        // hasSubstitute should survive the final setBattle(turnResult) call
        expect(result.current.battle?.player1.hasSubstitute).toBe(true)
    })
})