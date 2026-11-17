import { router } from 'expo-router';

import { deviceDealer } from './dealer';
import { useGameSession, type GameConfig } from './gameSessionStore';

/** Deals a fresh, never-played layout and opens the game screen. */
export async function startGame(config: GameConfig, startingPlayer = 0): Promise<void> {
  await useGameSession.getState().start(config, deviceDealer, startingPlayer);
  router.push('/game');
}

/** Rematch: new shuffle, the other player starts. Replaces the results screen. */
export async function playAgain(): Promise<boolean> {
  const session = await useGameSession.getState().rematch(deviceDealer);
  if (!session) return false;
  router.replace('/game');
  return true;
}
