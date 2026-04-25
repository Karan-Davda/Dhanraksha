import { useContext } from 'react'

import { NhostContext } from './NhostProvider'

export function useNhost() {
  const ctx = useContext(NhostContext)
  if (!ctx) {
    throw new Error('useNhost must be used within <NhostProvider>.')
  }
  return ctx
}





