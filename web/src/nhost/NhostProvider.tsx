import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient, withClientSideSessionMiddleware, type NhostClient } from '@nhost/nhost-js'

import { getEnv } from '../env'

export type NhostContextValue = {
  nhost: NhostClient | null
  session: ReturnType<NhostClient['getUserSession']>
  userId: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isConfigured: boolean
}

export const NhostContext = createContext<NhostContextValue | null>(null)

export function NhostProvider({ children }: { children: ReactNode }) {
  const env = getEnv()

  const nhost = useMemo(() => {
    if (!env.isConfigured) return null

    return createClient({
      subdomain: env.nhost.subdomain ?? undefined,
      region: env.nhost.region ?? undefined,
      configure: [withClientSideSessionMiddleware],
    })
  }, [env.isConfigured, env.nhost.region, env.nhost.subdomain])

  const [session, setSession] = useState<ReturnType<NhostClient['getUserSession']>>(() => nhost?.getUserSession() ?? null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!nhost) {
      setSession(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setSession(nhost.getUserSession())
    const unsub = nhost.sessionStorage.onChange((next) => {
      setSession(next)
    })
    setIsLoading(false)
    return unsub
  }, [nhost])

  const value: NhostContextValue = useMemo(() => {
    const userId = session?.user?.id ?? null
    return {
      nhost,
      session,
      userId,
      isAuthenticated: Boolean(userId),
      isLoading,
      isConfigured: env.isConfigured,
    }
  }, [env.isConfigured, isLoading, nhost, session])

  return <NhostContext.Provider value={value}>{children}</NhostContext.Provider>
}


