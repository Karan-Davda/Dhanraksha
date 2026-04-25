import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeProvider, type PaletteMode } from '@mui/material'

import { buildTheme } from './theme'

type ThemePreference = 'light' | 'dark' | 'system'

export type ThemeContextValue = {
  preference: ThemePreference
  mode: PaletteMode
  setPreference: (pref: ThemePreference) => void
  toggleMode: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'pfm:theme'
const REDUCE_MOTION_KEY = 'pfm:reduce-motion'

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  })

  // Apply saved reduce-motion preference on mount
  useEffect(() => {
    if (localStorage.getItem(REDUCE_MOTION_KEY) === 'true') {
      document.documentElement.setAttribute('data-reduce-motion', 'true')
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, preference)
  }, [preference])

  // Vault is always dark
  const mode: PaletteMode = 'dark'
  const theme = useMemo(() => buildTheme(), [])

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    root.style.colorScheme = mode
  }, [mode])

  const value: ThemeContextValue = useMemo(() => {
    return {
      preference,
      mode,
      setPreference: (pref) => setPreferenceState(pref),
      toggleMode: () => setPreferenceState((p) => (p === 'dark' ? 'light' : 'dark')),
    }
  }, [mode, preference])

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </ThemeContext.Provider>
  )
}
