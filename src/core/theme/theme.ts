import { createContext, useContext } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

export const STORAGE_KEY = 'oho.theme'

export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Stockage indisponible (navigation privée) : on suit le système.
  }
  return 'system'
}

/** Applique la préférence sur <html> : data-theme forcé, ou rien pour suivre le système. */
export function applyTheme(preference: ThemePreference, root: HTMLElement = document.documentElement) {
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', preference)
}

export const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (p: ThemePreference) => void } | null>(
  null,
)

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme doit être appelé sous <ThemeProvider>')
  return value
}
