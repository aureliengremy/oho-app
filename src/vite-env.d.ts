/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Clé VAPID publique des notifications push (lot 10) : publique par nature, la clé privée reste côté serveur. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}
