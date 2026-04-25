import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, Mail, Shield, ShieldCheck } from 'lucide-react'

import { useNhost } from '../nhost/useNhost'

function getPasswordStrength(pw: string): { level: number; label: string } {
  if (pw.length === 0) return { level: 0, label: '' }
  let score = 0
  if (pw.length >= 6)  score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { level: 1, label: 'Weak' }
  if (score <= 2) return { level: 2, label: 'Fair' }
  if (score <= 3) return { level: 3, label: 'Good' }
  return { level: 4, label: 'Strong' }
}

const strengthColors = ['', '#EF4444', '#F59E0B', '#F59E0B', '#10B981']

export function SignupPage() {
  const navigate = useNavigate()
  const { nhost, isAuthenticated, isLoading } = useNhost()
  const isMobile = useMediaQuery('(max-width: 767px)')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const strength = useMemo(() => getPasswordStrength(password), [password])

  useEffect(() => {
    if (isAuthenticated && !isLoading) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, isLoading, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nhost) return
    setSubmitting(true)
    try {
      const res = await nhost.auth.signUpEmailPassword({ email, password })
      if (!res.body.session) {
        toast.success('Vault created! Please verify your email, then sign in.')
        navigate('/auth/login', { replace: true })
        return
      }
      toast.success('Vault created!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign up failed.')
    } finally {
      setSubmitting(false)
    }
  }

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
      <Box sx={{ position: 'absolute', top: '10%', left: '15%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', bottom: '15%', right: '5%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

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
            Build your<br />
            <Box component="span" sx={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              wealth vault.
            </Box>
          </Typography>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65 }}>
            One place for every rupee. Track, plan, and grow — with your data completely private and isolated.
          </Typography>
        </Box>

        <Stack spacing={2}>
          {[
            { color: '#10B981', text: 'Income & expense tracking with smart categories' },
            { color: '#3B82F6', text: 'Savings goals with visual progress tracking' },
            { color: '#8B5CF6', text: 'Budget alerts before you overspend' },
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
            YOUR DATA STAYS PRIVATE · SECURED PER USER
          </Typography>
        </Stack>
      </Stack>
    </Box>
  )

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
      <Box sx={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

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
            <ShieldCheck size={16} color="#8B5CF6" />
            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8B5CF6', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Vault Identity
            </Typography>
          </Stack>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 26, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Create your vault
          </Typography>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13.5, color: '#71717A', mt: 0.75 }}>
            Set up your secure financial fortress
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
              autoComplete="new-password"
              required
              fullWidth
              placeholder="Create a strong passphrase"
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
            {password.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" spacing={0.5} sx={{ mb: 0.5 }}>
                  {[1, 2, 3, 4].map((seg) => (
                    <Box key={seg} sx={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      bgcolor: seg <= strength.level ? strengthColors[strength.level] : 'rgba(255,255,255,0.08)',
                      transition: 'background-color 200ms',
                      boxShadow: seg <= strength.level ? `0 0 6px ${strengthColors[strength.level]}60` : 'none',
                    }} />
                  ))}
                </Stack>
                <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11.5, color: strengthColors[strength.level], fontWeight: 500 }}>
                  {strength.label}
                </Typography>
              </Box>
            )}
          </Box>

          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !nhost}
            fullWidth
            sx={{ height: 48, fontSize: 14.5, fontWeight: 700, mt: 0.5 }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Create Vault →'}
          </Button>
        </Box>

        <Typography sx={{ mt: 3.5, textAlign: 'center', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13.5, color: '#52525B' }}>
          Already have a vault?{' '}
          <Link component={RouterLink} to="/auth/login" sx={{ color: '#60A5FA', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            Sign in
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
    </Box>
  )
}
