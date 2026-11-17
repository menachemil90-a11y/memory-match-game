import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Storage } from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL, isOnlineConfigured } from './config';

let client: SupabaseClient | null = null;

/** The Supabase client (null until online play is configured). */
export function getSupabase(): SupabaseClient | null {
  if (!isOnlineConfigured) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: {
          getItem: (key) => Storage.getItemAsync(key),
          setItem: (key, value) => Storage.setItemAsync(key, value),
          removeItem: async (key) => {
            await Storage.removeItemAsync(key);
          },
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
