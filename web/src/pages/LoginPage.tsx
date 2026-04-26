import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Fingerprint, Lock, Mail, Shield, ShieldCheck } from 'lucide-react'

import { useNhost } from '../nhost/useNhost'
import { getNhostAuthRedirectTo } from '../utils/authRedirectOrigin'

type LocationState = { from?: string } | null

// ─── Particle canvas background ──────────────────────────────────────────────

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let width  = canvas.offsetWidth
    let height = canvas.offsetHeight
    canvas.width  = width
    canvas.height = height

    type Particle = { x: number; y: number; vx: number; vy: number; r: number; alpha: number }
    const particles: Particle[] = Array.from({ length: 60 }, () => ({
      x:     Math.random() * width,
      y:     Math.random() * height,
      vx:    (Math.random() - 0.5) * 0.3,
      vy:    (Math.random() - 0.5) * 0.3,
      r:     Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.05,
    }))

    function draw() {
      ctx!.clearRect(0, 0, width, height)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i]!.x - particles[j]!.x
          const dy   = particles[i]!.y - particles[j]!.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            ctx!.beginPath()
            ctx!.moveTo(particles[i]!.x, particles[i]!.y)
            ctx!.lineTo(particles[j]!.x, particles[j]!.y)
            ctx!.strokeStyle = `rgba(59,130,246,${0.12 * (1 - dist / 100)})`
            ctx!.lineWidth = 0.5
            ctx!.stroke()
          }
        }
      }
      for (const p of particles) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(99,150,246,${p.alpha})`
        ctx!.fill()
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > width)  p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1
      }
      animId = requestAnimationFrame(draw)
    }

    draw()

    const onResize = () => {
      width = canvas.offsetWidth
      height = canvas.offsetHeight
      canvas.width  = width
      canvas.height = height
    }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize) }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
}

// ─── Login Page ───────────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { nhost, isAuthenticated, isLoading } = useNhost()
  const isMobile = useMediaQuery('(max-width: 767px)')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSending, setForgotSending] = useState(false)

  const from = (location.state as LocationState)?.from ?? '/dashboard'

  useEffect(() => {
    if (isAuthenticated && !isLoading) navigate(from, { replace: true })
  }, [from, isAuthenticated, isLoading, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nhost) return
    setSubmitting(true)
    try {
      const res = await nhost.auth.signInEmailPassword({ email, password })
      if (!res.body.session) { toast.error('Login failed.'); return }
      toast.success('Access granted.')
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onForgotPassword(e: FormEvent) {
    e.preventDefault()
    if (!nhost || !forgotEmail) return
    setForgotSending(true)
    try {
      const redirectTo = getNhostAuthRedirectTo()
      await nhost.auth.sendPasswordResetEmail({
        email: forgotEmail,
        ...(redirectTo ? { options: { redirectTo } } : {}),
      })
      toast.success('Reset link sent. Check your inbox.')
      setForgotOpen(false)
      setForgotEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setForgotSending(false)
    }
  }

  // ── Left brand panel ──────────────────────────────────────────────────────
  const brandPanel = (
    <Box sx={{
      flex: '0 0 55%',
      position: 'relative',
      overflow: 'hidden',
      background: '#09090B',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      px: { md: 8, lg: 10 },
      py: 6,
    }}>
      <ParticleCanvas />
      <Box sx={{ position: 'absolute', top: '10%', left: '15%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', bottom: '15%', right: '5%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <Stack spacing={4} sx={{ position: 'relative', zIndex: 1, maxWidth: 460 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box sx={{ width: 44, height: 44, borderRadius: '10px', background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(59,130,246,0.4)' }}>
            <Shield size={22} color="#fff" />
          </Box>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 20, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em' }}>
            Dhanraksha
          </Typography>
        </Stack>

        <Box>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 34, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.03em', lineHeight: 1.15, mb: 1.5 }}>
            Your financial<br />
            <Box component="span" sx={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              fortress.
            </Box>
          </Typography>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65 }}>
            Military-grade data isolation. Every transaction secured per user. Your vault, your rules.
          </Typography>
        </Box>

        <Stack spacing={2}>
          {[
            { color: '#10B981', text: 'End-to-end isolated data with row-level security' },
            { color: '#3B82F6', text: 'Multi-currency tracking with live FX rates' },
            { color: '#8B5CF6', text: 'Intelligent budget alerts before you overspend' },
          ].map((item) => (
            <Stack key={item.text} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: item.color, boxShadow: `0 0 8px ${item.color}`, flexShrink: 0 }} />
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13.5, color: 'rgba(255,255,255,0.5)' }}>
                {item.text}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 2 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10B981', boxShadow: '0 0 8px #10B981' }} />
          <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.12em' }}>
            SECURE_CONNECTION ACTIVE
          </Typography>
        </Stack>
      </Stack>
    </Box>
  )

  // ── Right form panel ──────────────────────────────────────────────────────
  const formPanel = (
    <Box sx={{
      flex: isMobile ? '1 1 100%' : '0 0 45%',
      bgcolor: '#09090B',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      px: { xs: 3, md: 6 },
      py: 6,
      position: 'relative',
    }}>
      <Box sx={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <Box sx={{ width: '100%', maxWidth: 380, position: 'relative' }}>
        {isMobile && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '9px', background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}>
              <Shield size={18} color="#fff" />
            </Box>
            <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 17, fontWeight: 700, color: '#F4F4F5' }}>
              Dhanraksha
            </Typography>
          </Stack>
        )}

        <Box sx={{ mb: 4 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <ShieldCheck size={16} color="#3B82F6" />
            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#3B82F6', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Secure Entry
            </Typography>
          </Stack>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 26, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Unlock your vault
          </Typography>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13.5, color: '#71717A', mt: 0.75 }}>
            Enter your credentials to continue
          </Typography>
        </Box>

        <Box component="form" onSubmit={onSubmit} sx={{ display: 'grid', gap: 2.5 }}>
          <Box>
            <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11.5, fontWeight: 600, color: '#52525B', mb: 0.75, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Vault Identity
            </Typography>
            <TextField
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              fullWidth
              placeholder="you@example.com"
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><Mail size={16} color="#52525B" /></InputAdornment>,
                  sx: { height: 48 },
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11.5, fontWeight: 600, color: '#52525B', mb: 0.75, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Access Key
            </Typography>
            <TextField
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              fullWidth
              placeholder="Your secret passphrase"
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start"><Lock size={16} color="#52525B" /></InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} sx={{ color: '#52525B' }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: { height: 48 },
                },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
            <Link
              component="button"
              type="button"
              onClick={() => { setForgotEmail(email); setForgotOpen(true) }}
              sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12.5, color: '#52525B', textDecoration: 'none', '&:hover': { color: '#60A5FA', textDecoration: 'underline' } }}
            >
              Forgot access key?
            </Link>
          </Box>

          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !nhost}
            fullWidth
            sx={{ height: 48, fontSize: 14.5, fontWeight: 700 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Unlock Vault →'}
          </Button>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.06)' }} />
            <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, color: '#3F3F46' }}>or</Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255,255,255,0.06)' }} />
          </Stack>

          <Button
            variant="outlined"
            fullWidth
            disabled
            startIcon={<Fingerprint size={16} />}
            sx={{ height: 44, fontSize: 13, color: '#3F3F46', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            Biometric auth (coming soon)
          </Button>
        </Box>

        <Typography sx={{ mt: 3.5, textAlign: 'center', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13.5, color: '#52525B' }}>
          No vault yet?{' '}
          <Link component={RouterLink} to="/auth/signup" sx={{ color: '#60A5FA', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            Create one
          </Link>
        </Typography>

        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
          <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'center', alignItems: 'center' }}>
            <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#10B981' }} />
            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: '#3F3F46', letterSpacing: '0.12em' }}>
              SECURE_CONNECTION ACTIVE
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'row', bgcolor: '#09090B' }}>
      {!isMobile && brandPanel}
      {formPanel}

      <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600 }}>
          Reset access key
        </DialogTitle>
        <Box component="form" onSubmit={onForgotPassword}>
          <DialogContent sx={{ pt: 0 }}>
            <DialogContentText sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13.5, mb: 2 }}>
              Enter your vault identity and we'll send a reset link.
            </DialogContentText>
            <TextField
              type="email"
              label="Vault identity (email)"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              fullWidth
              autoFocus
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Mail size={15} color="#52525B" /></InputAdornment> } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button variant="outlined" onClick={() => setForgotOpen(false)} type="button">Cancel</Button>
            <Button type="submit" variant="contained" disabled={forgotSending || !nhost}>
              {forgotSending ? <CircularProgress size={18} color="inherit" /> : 'Send reset link'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
