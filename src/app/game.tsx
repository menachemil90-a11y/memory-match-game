import { Redirect } from 'expo-router';

import { GameView } from '@/features/game/GameView';
import { useGameSession } from '@/features/game/gameSessionStore';

export default function GameScreen() {
  const session = useGameSession((s) => s.session);
  if (!session) return <Redirect href="/" />;
  // A new key per game resets all per-game UI state (deal, effects, timers).
  return <GameView key={session.id} session={session} />;
}
