import type { Pokemon, BattleState } from '../../../shared/types/battle';

function parseCondition(condition: string, existingMaxHp?: number): {
    hp: number;
    maxHp: number;
    status?: string;
} {
  if (!condition || condition === '0 fnt') {
    return { hp: 0, maxHp: existingMaxHp ?? 0, status: 'fnt' };
  }

  const [hpPart, status] = condition.split(' ');
  const [hp, maxHp] = hpPart.split('/').map(Number);
  return {
      hp: isNaN(hp) ? 0 : hp,
      maxHp: isNaN(maxHp) ? existingMaxHp ?? 0 : maxHp,
      status: status ?? undefined
  };
}

function parseDetails(details: string): { level: number } {
  const levelMatch = details.match(/L(\d+)/)
  return {
    level: levelMatch ? parseInt(levelMatch[1]) : 100
  };
}

function parseName(ident: string): string {
    return ident.split(': ')[1] ?? ident;
}

function parseMoveName(move: string): string {
    return move
        .replace(/([a-z])([A-Z])/g, '$1 $2') 
        .replace(/^./, c => c.toUpperCase())
        .replace(/^(\w+)(\w)/, (_, a, b) => a + b)
}

export function parsePokemon(raw: Record<string, any>, existingMaxHp?: number): Pokemon {
  const { hp, maxHp, status } = parseCondition(raw.condition, existingMaxHp)
  const { level } = parseDetails(raw.details)

  return {
    name:   parseName(raw.ident),
    hp,
    maxHp,
    level,
    status,
    moves:  (raw.moves as string[]).map(parseMoveName),
    stats:  raw.stats,
    item:   raw.item,
    ability: raw.ability,
    gender: raw.gender,
    teraType: raw.teraType || undefined,
    terastallized: raw.terastallized || false,
  }
}

export function parseBattleState(raw: Record<string, any>, existingId?: string, existing?: BattleState): BattleState {
  return {
    id: raw.battleId ?? raw.id ?? existingId,
    turn: raw.turn ?? 0,
    status: raw.status ?? 'active',
    winner: raw.winner,
    log: raw.turnLog ?? [],
    player1: parsePokemon(raw.player1, existing?.player1.maxHp),
    player2: parsePokemon(raw.player2, existing?.player2.maxHp),
  }
}