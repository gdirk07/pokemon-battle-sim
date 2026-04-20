import { useEffect, useRef } from "react";
import type { BattleState } from "../../../shared/types/battle" 
import { PokemonSprites } from "../components/PokemonSprite/PokemonSprite";
import { HPBar } from "../components/BattleStatus/HPBar";
import { StatusDot } from "../components/BattleStatus/StatusDot";
import { IS_MANUAL } from "../config/constants";

interface Props {
  battle: BattleState,
  displayedLog: string[],
  isPlaying: boolean,
  isLoading: boolean,
  onNextTurn: () => void,
}

export function BattleScreen({ battle, displayedLog, isPlaying, isLoading, onNextTurn }: Props) {
    const logEndRef= useRef<HTMLDivElement>(null);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [displayedLog]);
    const lastThreeLog = displayedLog.slice(-3).reverse()
    
    return (
        <div className="w-full h-full select-none bg-black/60 backdrop-blur-sm p-1 border border-white/10">
            {/* Opponent — top */}
            <div className="flex items-center gap-2 p-2">
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-white truncate">{battle.player2.name}</span>
                        <span className="text-[10px] text-gray-300">Lv.{battle.player2.level}</span>
                    </div>
                    <HPBar hp={battle.player2.hp} maxHp={battle.player2.maxHp} />
                    <div className="flex justify-between items-center mt-0.5">
                        <div className="h-4">
                            {battle.player2.status && (
                                <StatusDot status={battle.player2.status} />
                            )}
                        </div>
                        <span className="text-[9px] text-gray-400">{battle.player2.hp} / {battle.player2.maxHp}</span>
                    </div>
                </div>
                <PokemonSprites
                    sprites={battle.player2.sprites}
                    name={battle.player2.name}
                    species={battle.player2.species}
                    variant="frontDefault"
                    facing="left"
                    size={80}
                    hasSubstitute={battle.player2.hasSubstitute}
                />
            </div>

            {/* Battle log — 3 lines max */}
            <div className="px-2 py-1 min-h-[52px]">
                {lastThreeLog.map((entry, i) => (
                    <p
                        key={i}
                        className="text-[11px] leading-tight text-center text-white"
                        style={{ opacity: i === 0 ? 1 : i === 1 ? 0.5 : 0.25 }}
                    >
                        {entry}
                    </p>
                ))}
            </div>

            {/* Player — bottom */}
            <div className="flex items-center gap-2 p-2">
                <PokemonSprites
                    sprites={battle.player1.sprites}
                    name={battle.player1.name}
                    species={battle.player1.species}
                    variant="backDefault"
                    facing="right"
                    size={96}
                    hasSubstitute={battle.player1.hasSubstitute}
                />
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-white truncate">{battle.player1.name}</span>
                        <span className="text-[10px] text-gray-300">Lv.{battle.player1.level}</span>
                    </div>
                    <HPBar hp={battle.player1.hp} maxHp={battle.player1.maxHp} />
                    <div className="flex justify-between items-center mt-0.5">
                        <div className="h-4">
                            {battle.player1.status && (
                                <StatusDot status={battle.player1.status} />
                            )}
                        </div>
                        <span className="text-[9px] text-gray-400">{battle.player1.hp} / {battle.player1.maxHp}</span>
                    </div>
                </div>
            </div>

            {/* Turn + manual button */}
            <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-[10px] text-gray-400">Turn {battle.turn}</span>
                {IS_MANUAL && (
                    <button
                        className="text-[10px] px-2 py-0.5 bg-blue-500 text-white rounded disabled:opacity-50"
                        onClick={onNextTurn}
                        disabled={isLoading || isPlaying || battle.status === 'ended'}
                    >
                        {isLoading ? '...' : isPlaying ? '▶' : 'Next →'}
                    </button>
                )}
            </div>
        </div>
    )
}