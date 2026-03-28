import type { BattleState } from "../../../shared/types/battle";

interface Props {
    battle: BattleState | null,
    loading: boolean,
    onGenerate: () => void,
    onStart: () => void,
};

export function ContestantsScreen({ battle, loading, onGenerate, onStart }: Props) {
    return (
        <div className="mx auto flex items-center flex-col">
            <h1>Random Battle</h1>
            {battle ? (
                <div className="mx auto flex items-center max-w-sm">
                    <div className="mx auto flex flex-col max-w-sm items-center">
                        {battle.player1 && (
                            <img className="size-48 shrink-0" src={battle.player1.sprites?.officialArtwork ?? ''} alt={battle.player1.name} />
                        )}
                        <h3>{battle.player1.level ?? 100}</h3>
                        <h3>{battle.player1.name}</h3>
                        <h3>{battle.player1.item ?? 'None'}</h3>
                    </div>
                    <span>VS</span>
                    <div className="mx auto flex flex-col max-w-sm items-center">
                        {battle.player2 && (
                            <img className="size-48 shrink-0" src={battle.player2.sprites?.officialArtwork ?? ''} alt={battle.player2.name} />
                        )}
                        <h3>{battle.player2.level ?? 100}</h3>
                        <h3>{battle.player2.name}</h3>
                        <h3>{battle.player2.item ?? 'None'}</h3>
                    </div>
                </div>
            ) : (
                <p>Press start to generate a random matchup</p>
            )}
            <button 
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" 
                onClick={battle ? onStart : onGenerate} 
                disabled={loading}
            >
                {loading ? 'Generating...' : battle ? 'Start Battle!' : 'Generate Matchup'}
            </button>
        </div>
    )
}