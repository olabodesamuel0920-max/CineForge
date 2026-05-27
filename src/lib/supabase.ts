import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Safely instantiate the Supabase client if the credentials are provided.
// If the variables are missing, supabase will be null, triggering local fallback.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Clean factory client instantiation per-request to securely capture browser cookie contexts
export function getSupabase() {
  return supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
}

// Admin client instantiation to bypass RLS in trusted server contexts like webhooks
export function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  return supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;
}
