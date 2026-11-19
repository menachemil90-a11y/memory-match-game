import { Redirect, useLocalSearchParams } from 'expo-router';

import { isValidRoomCode, normalizeRoomCode } from '@/features/online/roomCode';

/**
 * Invite links: WEB_GAME_URL/join/?c=CODE (see inviteLink). In the web game
 * this page goes straight into the room's join flow; links sent before the web
 * game existed have the same address. Without a valid code: the online lobby,
 * where a code can be typed.
 */
export default function JoinScreen() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  const code = normalizeRoomCode(c ?? '');
  return <Redirect href={isValidRoomCode(code) ? `/online/${code}` : '/online'} />;
}
