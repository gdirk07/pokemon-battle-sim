import { useState } from 'react';
import { useBattle } from './hooks/useBattle';
import { ContestantsScreen } from './screens/ContestantsScreen';
import { BattleScreen } from './screens/BattleScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import type { Screen } from '../../shared/types/battle';

import './App.css'

export default function App() {
  const [screen, setScreen] = useState<Screen>('idle');
  const { battle, loading, error, generateTeams, fetchState, nextTurn } = useBattle();

  const handleGenerate = async() => {
    await generateTeams();
  }
  const handleStart = async() => {
    if (battle) {
      battle?.log.push("Start Battle");
      await fetchState(battle.id);
      setScreen('battle');
    }  
  }

  const handleNextTurn = async () => {
    if (!battle) return;
    await nextTurn(battle.id);
    if (battle.status === 'ended') setScreen('victory');
  }

  const handleReset = () => {
    setScreen('idle');
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Pokemon Battle Tester</h1>

      {error && (
        <p style={{ color: 'red' }}>Error: {error}</p>
      )}

      {screen === 'idle' && (
        <ContestantsScreen
          battle={battle}
          loading={loading}
          onGenerate={handleGenerate}
          onStart={handleStart}
        />
      )}

      {screen === 'battle' && battle && (
        <BattleScreen
          battle={battle}
          loading={loading}
          onNextTurn={handleNextTurn}
        />
      )}

      {screen === 'victory' && battle && (
        <VictoryScreen
          battle={battle}
          onReset={handleReset}
        />
      )}
    </div>
  );
}