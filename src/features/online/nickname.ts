/**
 * Nickname rules for online play (family audience, no free-text chat).
 * The server (supabase/migrations/*_online_core.sql) enforces the same rules;
 * a test keeps both word lists identical.
 */
export const MAX_NICKNAME_LENGTH = 14;

/** Short words that are also parts of normal names — matched as whole words only. */
// prettier-ignore
export const BLOCKED_WORDS = [
  'anal', 'anus', 'arse', 'ass', 'boob', 'boobs', 'butt', 'cock', 'crap', 'cum', 'damn', 'dick',
  'fag', 'hell', 'homo', 'jerk', 'kill', 'piss', 'poop', 'rape', 'sex', 'sexy', 'suck', 'tit',
  'tits', 'wtf',
] as const;

/** Never acceptable anywhere in a name (spaces ignored). */
// prettier-ignore
export const BLOCKED_FRAGMENTS = [
  'bastard', 'bitch', 'cunt', 'dildo', 'fuck', 'hitler', 'nazi', 'nigga', 'nigger', 'penis',
  'porn', 'pussy', 'retard', 'shit', 'slut', 'twat', 'vagina', 'whore',
] as const;

const LOOKALIKES: Record<string, string> = {
  '0': 'o',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

/** Look-alike folding. "1" can stand for "i" or "l", so both readings are returned. */
function folds(text: string): [string, string] {
  const base = [...text.toLowerCase()].map((c) => LOOKALIKES[c] ?? c).join('');
  const clean = (s: string) => s.replace(/[^a-z]/g, '');
  return [clean(base.replace(/1/g, 'i')), clean(base.replace(/1/g, 'l'))];
}

export type NicknameProblem = 'empty' | 'too_long' | 'characters' | 'not_allowed';
export type NicknameCheck = { ok: true; name: string } | { ok: false; reason: NicknameProblem };

export function checkNickname(input: string): NicknameCheck {
  const name = input.replace(/\s+/g, ' ').trim();
  if (name.length === 0) return { ok: false, reason: 'empty' };
  if ([...name].length > MAX_NICKNAME_LENGTH) return { ok: false, reason: 'too_long' };
  if (!/^[\p{L}\p{N} ]+$/u.test(name)) return { ok: false, reason: 'characters' };
  const words: readonly string[] = BLOCKED_WORDS;
  if (name.split(' ').some((token) => folds(token).some((f) => words.includes(f)))) {
    return { ok: false, reason: 'not_allowed' };
  }
  const joined = folds(name);
  if (BLOCKED_FRAGMENTS.some((w) => joined.some((f) => f.includes(w)))) {
    return { ok: false, reason: 'not_allowed' };
  }
  return { ok: true, name };
}
