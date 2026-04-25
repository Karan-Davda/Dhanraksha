import { useContext } from 'react'

import { ThemeContext } from './AppThemeProvider'

export function useThemeMode() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThemeMode must be used within <AppThemeProvider>.')
  }
  return ctx
}





