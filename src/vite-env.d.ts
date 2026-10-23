/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Clé VAPID publique des notifications push (lot 10) : publique par nature, la clé privée reste côté serveur. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

/** Commit de la version construite (« dev » en local), posé par vite.config.ts. */
declare const __APP_RELEASE__: string
/** Date de construction, ISO. */
declare const __APP_BUILT_AT__: string
