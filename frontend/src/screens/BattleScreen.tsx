import type { BattleState } from "../../../shared/types/battle" 

interface Props {
  battle: BattleState,
  loading: boolean,
  onNextTurn: () => void,
}

function HpBar({ hp, maxHp }: {hp: number | undefined; maxHp: number | undefined }) {
    if (!hp) hp = 0;
    if (!maxHp) maxHp = 1;
    const percentage = Math.round((hp / maxHp) * 100);
    const colour = 
        percentage > 50 ? 'bg-green-500' : percentage > 20 ? 'bg-yellow-500' : 'bg-red-500';
    return (
        <div className="w-3/4">
            <div className="bg-gray-700 rounded h-2 overflow-hidden">
                <div className={`h-full rounded transition-all duration-500 ${colour}`}
                    style={{ width: `${percentage}%` }} />
            </div>
            <div className="flex justify-end text-xs mb-1">
                <span className="text-xl">{hp} / {maxHp}</span>
            </div>
        </div>
    )
}

export function BattleScreen({ battle, loading, onNextTurn }: Props) {
    return (
        <div className="container m-auto">
            <p>Turn {battle.turn}</p>
            <div className="grid grid-cols-2 m-2">{/* arena container */}
                <div className="flex flex-col self-center col-span-1 h-24 bg-[#f9f3d8] border-black rounded-md outline-8 shadow-md order-last rounded">
                    <div className="flex flex-row justify-between m-2">
                        <p className="text-2xl">{battle.player1.name}</p>
                        <p className="text-2xl">lv: {battle.player1.level}</p>
                    </div>
                    <div className="flex justify-end m-2">
                        <HpBar hp={battle.player1.hp} maxHp={battle.player1.maxHp} />
                    </div>
                </div>
                <div className="flex justify-center col-span-1 order-3">
                    {battle.player1.sprites?.backDefault && (
                        <img className="size-48" src={battle.player1.sprites?.backDefault} alt={battle.player1.name} />
                    )}
                    
                </div>
                <div className="flex justify-center col-span-1 order-2 ">
                    {battle.player2.sprites?.frontDefault && (
                        <img className="size-48" src={battle.player2.sprites?.frontDefault} alt={battle.player2.name} />
                    )}
                </div>
                <div className="flex flex-col self-center col-span-1 h-24 bg-[#f9f3d8] border-black rounded-md outline-8 shadow-md order-first rounded">
                    <div className="flex flex-row justify-between m-2">
                        <p className="text-2xl">{battle.player2.name}</p>
                        <p className="text-2xl">lv: {battle.player2.level}</p>
                    </div>
                    <div className="flex justify-end m-2">
                        <HpBar hp={battle.player2.hp} maxHp={battle.player2.maxHp} />
                    </div>
                </div>
            </div>
            <div>{/* Battle log Container */}
                {[...battle.log].reverse().map((entry, i) => (
                    <p key={i}>
                        {entry}
                    </p>
                ))}
            </div>

            <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                onClick={onNextTurn}
                disabled={loading || battle.status === 'ended'}
            >
                {loading ? 'Procesing...' : 'Next Turn ->'}
            </button>
        </div>
    )
}