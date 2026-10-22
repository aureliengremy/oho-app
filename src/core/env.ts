/** Variables d'environnement publiques (préfixe VITE_). Aucun secret ici : elles finissent dans le bundle. */
export interface PublicEnv {
  supabaseUrl: string
  supabaseAnonKey: string
}

export function readEnv(source: Record<string, string | undefined> = import.meta.env): PublicEnv | null {
  const supabaseUrl = source.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = source.VITE_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseAnonKey) return null
  return { supabaseUrl, supabaseAnonKey }
}
