import { useEffect, useState, type ReactNode } from 'react'
import { applyTheme, readPreference, STORAGE_KEY, ThemeContext, type ThemePreference } from './theme'

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
