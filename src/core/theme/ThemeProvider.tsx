import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'oho.theme'

function readPreference(): ThemePreference {
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

const ThemeContext = createContext<{ preference: ThemePreference; setPreference: (p: ThemePreference) => void } | null>(
  null,
)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)

  useEffect(() => applyTheme(preference), [preference])

  function setPreference(next: ThemePreference) {
    setPreferenceState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Préférence non retenue, mais appliquée pour la session.
    }
  }

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme doit être appelé sous <ThemeProvider>')
  return value
}
