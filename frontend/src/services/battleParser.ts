import type { Pokemon, BattleState } from '../../../shared/types/battle';

function parseCondition(condition: string): {
    hp: number;
    maxHp: number;
    status?: string;
} {
    const [hpPart, status] = condition.split(' ');
    const [hp, maxHp] = hpPart.split('/').map(Number);
    return {
        hp: hp ?? 0,
        maxHp: maxHp ?? 0,
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
export function parsePokemon(raw: Record<string, any>): Pokemon {
  const { hp, maxHp, status } = parseCondition(raw.condition)
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
    teraType: raw.teraType || undefined,
    terastallized: raw.terastallized || false,
  }
}

export function parseBattleState(raw: Record<string, any>): BattleState {
  return {
    id: raw.id,
    turn: raw.turn ?? 0,
    status: raw.status ?? 'active',
    winner: raw.winner,
    log: raw.log ?? [],
    player1: parsePokemon(raw.player1),
    player2: parsePokemon(raw.player2),
  }
}