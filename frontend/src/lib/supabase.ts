import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawAnonKey &&
  rawUrl.trim().length > 0 &&
  rawAnonKey.trim().length > 0 &&
  /^https?:\/\//i.test(rawUrl.trim())
);

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'placeholder-anon-key';

const supabaseUrl = isSupabaseConfigured ? rawUrl!.trim() : fallbackUrl;
const supabaseAnonKey = isSupabaseConfigured ? rawAnonKey!.trim() : fallbackKey;

if (!isSupabaseConfigured) {
  console.warn(
    '[NeuroScan Auth] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Supabase client initialized in fallback mode.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isSupabaseConfigured,
    autoRefreshToken: isSupabaseConfigured,
    detectSessionInUrl: isSupabaseConfigured,
    storage: window.localStorage,
    storageKey: 'neuroscan-auth-token',
  },
});

