/**
 * Base URL for Nhost auth email links (email verification, password reset).
 * Must match an entry in Nhost Auth → allowed redirect URLs (and client URL rules).
 *
 * Defaults to `window.location.origin` so production (e.g. Vercel) and localhost work
 * without extra config. Set `VITE_APP_URL` when the public URL differs from the
 * browser origin (rare: proxies, canonical domain vs preview host).
 */
export function getNhostAuthRedirectTo(): string {
  const fromEnv = import.meta.env.VITE_APP_URL
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim().replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return ''
}
