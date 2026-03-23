import type { BattleState } from "../../../shared/types/battle" 

interface Props {
  battle: BattleState,
  loading: boolean,
  onNextTurn: () => void,
}

function hpBar({ hp, maxHp }: {hp: number; maxHp: number }) {
    const percentage = Math.round((hp / maxHp) * 100);
    const colour = 
        percentage > 50 ? '#2ecc71' : percentage > 20 ? '#f39c12' : '#e74c4c';
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span>HP</span>
                <span>{hp} / {maxHp}</span>
            </div>
            <div style={{ background: '#333', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${percentage}%`, height: '100%', background: colour, borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
        </div>
    )
}

export function BattleScreen({ battle, loading, onNextTurn }: Props) {
    return (
        <div>
            <p>Turn {battle.turn}</p>
            <div>
                <div>
                    A battle!
                </div>
            </div>
        </div>
    )
}