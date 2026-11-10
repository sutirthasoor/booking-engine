import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// The server may use the service role key when provided (recommended), otherwise
// it falls back to the same anon key the original browser page used.
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
