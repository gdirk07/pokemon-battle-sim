import { IS_MANUAL } from "../config/constants";
import type { BattleState } from "../../../shared/types/battle";
import { PokemonSprites } from "../components/PokemonSprite/PokemonSprite";

interface Props {
    battle: BattleState | null,
    loading: boolean,
    countdown: number | null,
    onGenerate: () => void,
    onStart: () => void,
};

export function ContestantsScreen({ battle, loading, countdown, onGenerate, onStart }: Props) {
    return (
        <div className="w-full h-full select-none bg-black/60 backdrop-blur-sm p-2 border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">Random Battle</span>
                {countdown !== null && (
                    <span className="text-[10px] font-bold text-yellow-400">
                        Betting closes in {countdown}s
                    </span>
                )}
            </div>
            {battle ? (
                <div className="flex items-center gap-1">
                    {/* Player 1 */}
                    <div className="flex-1 flex flex-col items-center">
                        <PokemonSprites
                            sprites={battle.player1.sprites}
                            name={battle.player1.name}
                            species={battle.player1.species}
                            variant="officialArtwork"
                            facing="right"
                            size={100}
                        />
                        <span className="text-xs font-bold text-white text-center leading-tight">
                            {battle.player1.name}
                        </span>
                        <span className="text-[9px] text-gray-400">Lv.{battle.player1.level}</span>
                        <span className="text-[10px] text-gray-300 truncate max-w-full">
                            Ability: {battle.player1.ability ?? 'No ability'}
                        </span>
                        <span className="text-[10px] text-gray-300 truncate max-w-full">
                            {battle.player1.item ?? 'No item'}
                        </span>
                    </div>

                    {/* VS */}
                    <div className="flex flex-col items-center gap-1 px-1">
                        <span className="text-sm font-black text-yellow-400">VS</span>
                    </div>

                    {/* Player 2 */}
                    <div className="flex-1 flex flex-col items-center">
                        <PokemonSprites
                            sprites={battle.player2.sprites}
                            name={battle.player2.name}
                            species={battle.player2.species}
                            variant="officialArtwork"
                            facing="left"
                            size={100}
                        />
                        <span className="text-xs font-bold text-white text-center leading-tight">
                            {battle.player2.name}
                        </span>
                        <span className="text-[9px] text-gray-400">Lv.{battle.player2.level}</span>
                        <span className="text-[10px] text-gray-300 truncate max-w-full">
                            Ability: {battle.player2.ability ?? 'No ability'}
                        </span>
                        <span className="text-[10px] text-gray-300 truncate max-w-full">
                            {battle.player2.item ?? 'No item'}
                        </span>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-gray-400 text-center py-4">
                    Generating matchup...
                </p>
            )}
            {IS_MANUAL && (
                <div className="flex gap-2 mt-3">
                    <button
                        className="flex-1 text-[10px] py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-40 transition-colors"
                        onClick={battle ? onStart : onGenerate}
                        disabled={loading}
                    >
                        {loading ? 'Generating...' : battle ? 'Start Battle' : 'Generate'}
                    </button>
                    {battle && countdown !== null && (
                        <button
                            className="text-[10px] px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors"
                            onClick={onStart}
                        >
                            Skip
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}