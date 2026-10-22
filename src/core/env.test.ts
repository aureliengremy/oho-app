import { describe, expect, it } from 'vitest'
import { readEnv } from './env'

describe('readEnv', () => {
  it('renvoie null tant que les variables Supabase manquent', () => {
    expect(readEnv({})).toBeNull()
    expect(readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: ' ' })).toBeNull()
  })

  it('lit et nettoie les variables présentes', () => {
    expect(readEnv({ VITE_SUPABASE_URL: ' https://x.supabase.co ', VITE_SUPABASE_ANON_KEY: 'clé' })).toEqual({
      supabaseUrl: 'https://x.supabase.co',
      supabaseAnonKey: 'clé',
    })
  })
})
