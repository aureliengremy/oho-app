import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readEnv } from './env'

const env = readEnv()

/**
 * Client Supabase unique de l'app, ou null tant que .env.local n'est pas rempli.
 * La session est persistée et rafraîchie automatiquement (session longue, décision S15).
 */
export const supabase: SupabaseClient | null = env
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
