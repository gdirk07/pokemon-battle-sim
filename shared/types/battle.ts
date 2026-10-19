export interface PokemonStats {
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
}

export interface PokemonSprites {
    officialArtwork: string | null,
    frontDefault: string | null,
    backDefault: string | null,
};

export interface HpChange {
    side: 'p1' | 'p2',
    hp: number,
    maxHp: number | null,
};

export interface StatusChange {
    side: 'p1' | 'p2',
    value: string | null,
};
export interface Pokemon {
    name: string,
    species: string,
    ability?: string,
    level: number,
    item?: string,
    gender?: string,
    sprites?: PokemonSprites,
    hp?: number,
    maxHp?: number,
    status?: string,
    moves?: string[],
    stats?: {},
    teraType?: string,
    terastallized: boolean,
    hasSubstitute: boolean,
};

export interface SubstituteChange {
    side: 'p1' | 'p2',
    active: boolean,
}

export interface TurnLogEntry {
    text: string,
    hp: HpChange | null,
    status: StatusChange | null,
    substitute: SubstituteChange | null,
};
export interface BattleState {
    id: string,
    player1: Pokemon,
    player2: Pokemon,
    turn: number,
    log: TurnLogEntry[],
    status: 'idle' | 'active' | 'ended',
    winner?: 'player1' | 'player2',
};

export type Screen =
    'idle' |
    'battle' |
    'victory';

export type Phase = 'idle' | 'betting' | 'fighting' | 'victory';

// Raw state as produced by the backend (Showdown request objects + turnLog); run it through parseBattleState().
export type RawBattleState = Record<string, any>;

export interface Bets { p1Total: number, p2Total: number };

export type Mode = 'manual' | 'streamerbot';

export type ServerMessage =
    | { type: 'snapshot', mode: Mode, phase: Phase, deadline: number | null, bets: Bets, seq: number, battleId: string | null, state: RawBattleState | null }
    | { type: 'phase', phase: Phase, deadline: number | null, state?: RawBattleState }
    | ({ type: 'bets' } & Bets)
    | { type: 'turn', seq: number, battleId: string, state: RawBattleState };

export type Command = 'start' | 'begin' | 'next' | 'reset';

// Omitted/empty side = random Pokémon. Accepted only when the backend has ALLOW_SPECIES_PICK on.
export interface StartArgs {
    p1Species?: string,
    p2Species?: string,
}

export type ClientMessage =
    | { type: 'ack', seq: number, durationMs?: number }
    | { type: 'command', name: Command, args?: StartArgs };
