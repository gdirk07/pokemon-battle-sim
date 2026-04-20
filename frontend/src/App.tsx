import { useCallback, useEffect, useRef, useState } from 'react';
import { useBattle } from './hooks/useBattle';
import { useStreamerBot } from './hooks/useStreamerBot';
import { ContestantsScreen } from './screens/ContestantsScreen';
import { BattleScreen } from './screens/BattleScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import type { Screen } from '../../shared/types/battle';
import { IS_MANUAL, BETTING_MS, APP_W, APP_H } from './config/constants';

import './App.css'
import { Betting } from './components/Betting/Betting';

export default function App() {
  const [screen, setScreen] = useState<Screen>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [p1Total, setP1Total] = useState(0);
  const [p2Total, setP2Total] = useState(0);
  const { 
    battle,
    displayedLog,
    isPlaying,
    isLoading,
    error,
    generateTeams,
    beginBattle,
    nextTurn,
    reset,
  } = useBattle();

  const isStartingRef = useRef(false);
  const readySentRef = useRef(false);

  useEffect(() => {
    if (battle?.status === 'ended' && !isPlaying) {
      const timer = setTimeout(() => setScreen('victory'), 3000);
      return () => clearTimeout((timer));
    }
  }, [battle?.status, isPlaying])

  const handleStartRef = useRef<() => void>(() => {});
  const handleNextTurnRef = useRef<() => void>(() => {});

  const { send } = useStreamerBot({
    onStartBattle: () => handleStartRef.current(),
    onNextTurn: () => handleNextTurnRef.current(),
    onBet: (p1, p2) => {
      setP1Total(p1 ?? 0);
      setP2Total(p2 ?? 0);
    },
    enabled: !IS_MANUAL,
  })

  const handleStart = useCallback(async() => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    try {
      reset();
      setScreen('idle');
      setCountdown(null);
      await generateTeams();

      // placeholder event, does nothing so far
      console.log('sending PB_ANNOUNCE_CONTESTANTS');
      send('PB_ANNOUNCE_CONTESTANTS', {
        player1: battle?.player1.name,
        player2: battle?.player2.name,
      });
      setP1Total(0);
      setP2Total(0);

      let remaining = BETTING_MS / 1000;
      setCountdown(remaining);

      const tick = setInterval(async() => {
        remaining -= 1
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(tick);
          setCountdown(null);
          console.log('COUNTDOWN FINISHED');
          if (isStartingRef.current) {
            console.log('sending PB_BATTLE_STARTING');
            send('PB_BATTLE_STARTING');
            await beginBattle();
            console.log("setting screen to battle");
            setScreen('battle');
          }
        }
      }, 1000);
    } catch (err) {
      isStartingRef.current = false;
    }   
  }, [reset, generateTeams, send, battle]);

  useEffect(() => {
    if (screen === 'battle' && !isPlaying && !isLoading && battle?.status === 'active') {
      if (readySentRef.current) return;
      readySentRef.current = true;
      console.log('sending PB_READY_FOR_NEXT_TURN');
      send('PB_READY_FOR_NEXT_TURN');
    }
    if (isPlaying) {
      readySentRef.current = false;
    }
  }, [isPlaying, isLoading, screen, battle?.status]);

  useEffect(() => {
    if (battle?.status === 'ended') {
      console.log('sending PB_BATTLE_ENDED');
      const winner = battle.winner === 'player1' ? battle.player1 : battle.player2;
      send('PB_BATTLE_ENDED', {
        winner: winner,
        winnerName: winner.name,
      });
      isStartingRef.current = false;
    }
  }, [battle?.status]);

  const handleNextTurn = useCallback(async () => {
    if (isPlaying || isLoading) return;
    await nextTurn();
  }, [isPlaying, isLoading, nextTurn]);

  const handleReset = useCallback(() => {
    reset();
    setScreen('idle');
    setCountdown(null);
  }, [reset]);

  useEffect(() => {
    handleStartRef.current = handleStart
  }, [handleStart]);

  useEffect(() => {
    handleNextTurnRef.current = handleNextTurn
  }, [handleNextTurn]);

  return (
    <div className="w-screen h-screen flex items-start justify-end p-0">
      <div 
        className="overflow-hidden"
        style={{ 
          width: APP_W,
          height: APP_H,
        }}
      >
        {error && (
          <p style={{ color: 'red' }}>Error: {error}</p>
        )}
        <Betting
          p1Total={p1Total}
          p2Total={p2Total}
          isOpen={screen === 'idle' && countdown !== null}
        />
        {screen === 'idle' && (
          <ContestantsScreen
            battle={battle}
            loading={isLoading}
            countdown={countdown}
            onGenerate={handleStart}
            onStart={async() => {
              setCountdown(null);
              await beginBattle();
              setScreen('battle');
              isStartingRef.current = false;
            }}
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
    </div>
  );
}