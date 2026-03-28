import type { BattleState } from "../../../shared/types/battle";

interface Props {
    battle: BattleState,
    onReset: () => void,
}

export function VictoryScreen({ battle, onReset }: Props) {
    const winner = battle.winner === 'player1' ? battle.player1 : battle.player2;

    return (
        <div className="flex flex-col">
            <h1>WINNER!</h1>
            <div className="justify-items-center">
                {winner.sprites?.officialArtwork && (
                    <img src={winner.sprites?.officialArtwork}
                        alt={winner.name}
                    />
                )}
            </div>
            <div>
                {winner.name}
            </div>
            <div>
                Battle lasted {battle.turn} turns
            </div>
            <div>
                <button onClick={onReset}>
                    New Battle
                </button>
            </div>
        </div>
    )
}