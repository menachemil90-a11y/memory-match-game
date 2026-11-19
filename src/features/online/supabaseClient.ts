import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { kvStateStorage } from '@/lib/kvStorage';

import { SUPABASE_ANON_KEY, SUPABASE_URL, isOnlineConfigured } from './config';

let client: SupabaseClient | null = null;

/** The Supabase client (null until online play is configured). */
export function getSupabase(): SupabaseClient | null {
  if (!isOnlineConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // The anonymous session: SQLite in the app, localStorage on the web
        // (same key-value store as settings — see kvStorage.ts / kvStorage.web.ts).
        storage: {
          getItem: (key) => kvStateStorage.getItem(key),
          setItem: (key, value) => void kvStateStorage.setItem(key, value),
          removeItem: (key) => void kvStateStorage.removeItem(key),
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 20 } },
    });
    // Refresh tokens only while the app is in the foreground.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void client?.auth.startAutoRefresh();
      else void client?.auth.stopAutoRefresh();
    });
  }
  return client;
}
