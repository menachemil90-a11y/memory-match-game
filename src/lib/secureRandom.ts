import * as Crypto from 'expo-crypto';

import { createRandomSource, type Hasher, type RandomSource } from '@/game';

/** App-wide cryptographically secure RNG (expo-crypto). */
export const secureRandom: RandomSource = createRandomSource((n) => Crypto.getRandomBytes(n));

/** SHA-256 hex digest via expo-crypto. */
export const sha256: Hasher = (input) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
