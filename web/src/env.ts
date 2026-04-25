import { z } from 'zod'

const EnvSchema = z.object({
  VITE_NHOST_SUBDOMAIN: z.string().min(1).optional(),
  VITE_NHOST_REGION: z.string().min(1).optional(),
})

export type AppEnv = {
  nhost: {
    subdomain: string | null
    region: string | null
  }
  isConfigured: boolean
}

export function getEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(import.meta.env)
  const subdomain = parsed.success ? parsed.data.VITE_NHOST_SUBDOMAIN ?? null : null
  const region = parsed.success ? parsed.data.VITE_NHOST_REGION ?? null : null

  return {
    nhost: { subdomain, region },
    isConfigured: Boolean(subdomain && region),
  }
}





