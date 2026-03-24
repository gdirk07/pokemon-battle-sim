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

export interface Pokemon {
    name: string,
    species?: string,
    ability?: string,
    level: number,
    item?: string,
    sprites?: PokemonSprites,
    hp?: number,
    maxHp?: number,
    status?: string,
    moves?: string[],
    stats?: {},
    teraType?: string,
    terastallized: boolean,
};

export interface BattleState {
    id: string
    player1: Pokemon
    player2: Pokemon
    turn: number
    log: string[]
    status: 'idle' | 'active' | 'ended'
    winner?: 'player1' | 'player2'
};

export type Screen =
    'idle' |
    'battle' |
    'victory';
    