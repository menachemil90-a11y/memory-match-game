import Constants from 'expo-constants';

/**
 * Supabase connection, from EXPO_PUBLIC_* variables (set in .env or the EAS
 * build profile). The anon key is public by design; RLS protects the data.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isOnlineConfigured =
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;

/** The app's version (from app.json), sent to the server for the min-version check. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

/** Invite links use the custom scheme for now (https App Links need a domain). */
export const APP_SCHEME = 'memorymatch';

export const TURN_SECONDS = 30;
export const DISCONNECT_GRACE_SECONDS = 60;
export const HEARTBEAT_MS = 10_000;
