import { useBattleSocket } from './hooks/useBattleSocket';
import { useCountdown, useDelayedFlag } from './hooks/useCountdown';
import { ContestantsScreen } from './screens/ContestantsScreen';
import { BattleScreen } from './screens/BattleScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import type { Screen } from '../../shared/types/battle';
import { APP_W, APP_H, VICTORY_SCREEN_DELAY_MS } from './config/constants';
import { Betting } from './components/Betting/Betting';
import { DevPanel } from './components/DevPanel/DevPanel';

// Opt-in per URL so the OBS browser source (no ?dev) never shows dev tools.
const DEV_TOOLS = new URLSearchParams(window.location.search).has('dev');

import './App.css'

/**
 * Pure view. The backend runs the show (betting timer, turn pacing, Streamer.bot); this overlay renders
 * what it is told and acknowledges each turn once it has finished animating it.
 */
export default function App() {
  const {
    mode, phase, deadline, bets, battle, displayedLog, isPlaying, isLoading, connected, command,
  } = useBattleSocket();

  // The backend decides (PB_MODE); the overlay just follows. No frontend env file needed.
  const isManual = mode === 'manual';

  const countdown = useCountdown(deadline);
  // Keep the final battle frame up briefly before cutting to the victory screen.
  const victoryReady = useDelayedFlag(phase === 'victory' && !isPlaying, VICTORY_SCREEN_DELAY_MS);

  const screen: Screen =
    phase === 'fighting' ? 'battle'
    : phase === 'victory' ? (victoryReady ? 'victory' : 'battle')
    : 'idle';

  return (
    <div className="w-screen h-screen flex items-start justify-end p-0">
      <div className="overflow-hidden" style={{ width: APP_W, height: APP_H }}>
        {!connected && (
          <p style={{ color: 'orange', fontSize: 10 }}>Connecting to battle server…</p>
        )}
        {mode === 'streamerbot' && (
          <Betting p1Total={bets.p1Total} p2Total={bets.p2Total} isOpen={phase === 'betting'} />
        )}

        {screen === 'idle' && (
          <ContestantsScreen
            battle={battle}
            loading={isLoading}
            isManual={isManual}
            countdown={phase === 'betting' ? countdown : null}
            onGenerate={() => command('start')}
            onStart={() => command('begin')}
          />
        )}

        {screen === 'battle' && battle && (
          <BattleScreen
            battle={battle}
            displayedLog={displayedLog}
            isPlaying={isPlaying}
            isLoading={isLoading}
            isManual={isManual}
            onNextTurn={() => command('next')}
          />
        )}

        {screen === 'victory' && battle && (
          <VictoryScreen battle={battle} isManual={isManual} onReset={() => command('reset')} />
        )}
      </div>
      {DEV_TOOLS && isManual && <DevPanel phase={phase} />}
    </div>
  );
}