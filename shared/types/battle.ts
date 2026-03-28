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
    reverseFrontDefault: string | null,
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
    species?: string,
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
};

export interface TurnLogEntry {
    text: string,
    hp: HpChange | null,
    status: StatusChange | null,
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
    