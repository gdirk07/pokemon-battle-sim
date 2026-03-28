import { useEffect, useState } from 'react';
import { useBattle } from './hooks/useBattle';
import { useStreamerBot } from './hooks/useStreamerBot';
import { ContestantsScreen } from './screens/ContestantsScreen';
import { BattleScreen } from './screens/BattleScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import type { Screen } from '../../shared/types/battle';

import './App.css'

const isManual = import.meta.env.VITE_MODE === 'manual';
const TURN_INTERNAL_MS = 8000;
const VICTORY_DELAY_MS = 60000;

export default function App() {
  const [screen, setScreen] = useState<Screen>('idle');
  const { 
    battle,
    displayedLog,
    isPlaying,
    isLoading,
    error,
    generateTeams,
    fetchState,
    nextTurn,
    reset,
  } = useBattle();

  useEffect(() => {
    if (battle?.status === 'ended' && !isPlaying) {
      const timer = setTimeout(() => setScreen('victory'), 3000);
      return () => clearTimeout((timer));
    }
  }, [battle?.status, isPlaying])

  const handleStart = async() => {
    if (battle) {
      await fetchState(battle.id);
      setScreen('battle');
    }  
  }

  const handleNextTurn = async () => {
    if (!battle) return;
    await nextTurn();
    if (battle.status === 'ended') setScreen('victory');
  }

  const handleReset = () => {
    reset();
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
          loading={isLoading}
          onGenerate={generateTeams}
          onStart={handleStart}
        />
      )}

      {screen === 'battle' && battle && (
        <BattleScreen
          battle={battle}
          displayedLog={displayedLog}
          isPlaying={isPlaying}
          isLoading={isLoading}
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