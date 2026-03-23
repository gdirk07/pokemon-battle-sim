import type { BattleState } from "../../../shared/types/battle";

interface Props {
    battle: BattleState,
    onReset: () => void,
}

export function VictoryScreen({ battle, onReset }: Props) {
    const winner = battle.winner === 'player1' ? battle.player1 : battle.player2;

    return (
        <div>
            <h1>WINNER!</h1>
            <div>
                {winner.toString()}
            </div>
        </div>
    )
}