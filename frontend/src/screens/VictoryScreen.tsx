import type { BattleState } from "../../../shared/types/battle";
import { PokemonSprites } from "../components/PokemonSprite/PokemonSprite";
import { IS_MANUAL } from "../config/constants";

interface Props {
    battle: BattleState,
    onReset: () => void,
}

export function VictoryScreen({ battle, onReset }: Props) {
    const winner = battle.winner === 'player1' ? battle.player1 : battle.player2;
    const turns = battle.turn > 1 ? 'turns' : 'turn';
    return (
        <div className="w-full h-full select-none bg-black/60 backdrop-blur-sm p-2 border border-white/10">
            <div className="flex items-center justify-center">
                <span className="text-[30px] text-white uppercase tracking-widest">WINNER!</span>
            </div>
            <div className="flex items-center justify-center">
                {winner.sprites?.officialArtwork && (
                    <PokemonSprites
                        sprites={winner.sprites}
                        name={winner.name}
                        species={winner.species}
                        variant="officialArtwork"
                        facing="right"
                        size={180}
                    />
                )}
            </div>
            <div className="flex flex-col items-center justify-center">
                <span className="text-[20px] text-white uppercase tracking-widest">
                    {winner.name}
                </span>
                <span className="text-[20px] text-gray-300 uppercase tracking-widest">
                    Battle lasted {battle.turn} {turns}
                </span>
                <span className="text-[10px] text-gray-300 uppercase tracking-widest">
                    Getting ready for the next battle...
                </span>
            </div>
            <div>
                {IS_MANUAL && (
                    <button onClick={onReset}>
                        New Battle
                    </button>
                )} 
            </div>
        </div>
    )
}