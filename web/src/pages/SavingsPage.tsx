import { useRef, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import toast from 'react-hot-toast'
import { MoreHorizontal, PiggyBank, Plus, Trash2, Target } from 'lucide-react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Float } from '@react-three/drei'
import type { Mesh } from 'three'

import { CURRENCIES } from '../data/currencies'
import { nhostGraphql } from '../api/nhostGraphql'
import { Queries } from '../api/queries'
import { ensureFxRate } from '../features/expenses/fx'
import { AddGoalDialog, type AddGoalValues } from '../features/savings/AddGoalDialog'
import { AddSavingsTransactionDialog, type AddSavingsTransactionValues } from '../features/savings/AddSavingsTransactionDialog'
import { useNhost } from '../nhost/useNhost'
import type { SavingsGoal, SavingsTransaction, UserBalances, UserMetadata } from '../types/domain'
import { calcMonthlyNeeded, formatCurrency, formatDate } from '../utils/format'

// ─── Three.js Vault Torus ─────────────────────────────────────────────────────

function VaultTorus() {
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.4
    ref.current.rotation.y = clock.elapsedTime * 0.4
  })
  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.4}>
      <mesh ref={ref}>
        <torusGeometry args={[1.2, 0.38, 64, 128]} />
        <MeshDistortMaterial
          color="#3B82F6"
          emissive="#1d4ed8"
          emissiveIntensity={0.4}
          metalness={0.9}
          roughness={0.05}
          distort={0.2}
          speed={2}
          transparent
          opacity={0.85}
        />
      </mesh>
    </Float>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SavingsPage() {
  const { nhost, userId } = useNhost()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'goals' | 'transactions'>('goals')
  const [openGoal, setOpenGoal] = useState(false)
  const [openTxn, setOpenTxn] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [menuGoalId, setMenuGoalId] = useState<string | null>(null)

  const metadataQuery = useQuery({
    queryKey: ['user_metadata', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ user_metadata_by_pk: UserMetadata | null }, { userId: string }>(
        nhost, Queries.userMetadata, { userId },
      )
      return data.user_metadata_by_pk
    },
  })

  const goalsQuery = useQuery({
    queryKey: ['savings_goals', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ savings_goals: (SavingsGoal & { created_at: string })[] }, { userId: string }>(
        nhost, Queries.savingsGoals, { userId },
      )
      return data.savings_goals
    },
    throwOnError: (e) => { toast.error(`Savings goals: ${e instanceof Error ? e.message : 'Failed to load'}`); return false },
  })

  const txnsQuery = useQuery({
    queryKey: ['savings', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ savings: (SavingsTransaction & { created_at: string })[] }, { userId: string; limit: number; offset: number }>(
        nhost, Queries.savingsTransactions, { userId, limit: 200, offset: 0 },
      )
      return data.savings
    },
    throwOnError: (e) => { toast.error(`Savings transactions: ${e instanceof Error ? e.message : 'Failed to load'}`); return false },
  })

  const baseCurrency  = metadataQuery.data?.base_currency ?? 'USD'
  const currencies    = CURRENCIES
  const goals         = goalsQuery.data ?? []
  const txns          = txnsQuery.data ?? []
  const balances      = queryClient.getQueryData<UserBalances | null>(
    ['sidebar_balances', nhost ? 'configured' : 'not_configured'],
  ) ?? null

  const progressByGoal = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of txns) {
      if (!t.goal_id) continue
      const delta = t.direction === 'deposit' ? Number(t.amount) : -Number(t.amount)
      map.set(t.goal_id, (map.get(t.goal_id) ?? 0) + delta)
    }
    return map
  }, [txns])

  const totalSaved = useMemo(() => {
    return txns.reduce((acc, t) => {
      const delta = t.direction === 'deposit' ? Number(t.base_amount) : -Number(t.base_amount)
      return acc + delta
    }, 0)
  }, [txns])

  const activeGoalCount = useMemo(() => goals.filter((g) => g.status === 'active').length, [goals])

  const addGoalMutation = useMutation({
    mutationFn: async (values: AddGoalValues) => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      await nhostGraphql(nhost, Queries.insertSavingsGoal, {
        object: {
          user_id: userId,
          name: values.name.trim(),
          target_amount: values.target_amount,
          currency: values.currency,
          deadline: values.deadline ? values.deadline : null,
          status: 'active',
        },
      })
    },
    onSuccess: async () => {
      await goalsQuery.refetch()
      toast.success('Goal created.')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create goal.'),
  })

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!nhost) throw new Error('Not configured')
      await nhostGraphql(nhost, Queries.deleteSavingsGoal, { id })
    },
    onSuccess: async () => {
      await goalsQuery.refetch()
      toast.success('Goal deleted.')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete goal.'),
  })

  const addTxnMutation = useMutation({
    mutationFn: async (values: AddSavingsTransactionValues) => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const fxDate        = values.date
      const quoteCurrency = values.currency
      const fxRate        = await ensureFxRate({ nhost, userId, baseCurrency, quoteCurrency, rateDate: fxDate })
      const baseAmount    = quoteCurrency === baseCurrency ? values.amount : values.amount / fxRate
      await nhostGraphql(nhost, Queries.insertSavingsTransaction, {
        object: {
          user_id: userId,
          amount: values.amount,
          currency: values.currency,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          fx_rate: fxRate,
          fx_date: fxDate,
          direction: values.direction,
          source: values.source,
          date: values.date,
          notes: values.notes?.trim() || null,
          goal_id: values.goal_id,
        },
      })
    },
    onSuccess: async () => {
      await txnsQuery.refetch()
      toast.success('Saved.')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save.'),
  })

  const deleteTxnMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!nhost) throw new Error('Not configured')
      await nhostGraphql(nhost, Queries.deleteSavingsTransaction, { id })
    },
    onSuccess: async () => {
      await txnsQuery.refetch()
      toast.success('Deleted.')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete.'),
  })

  return (
    <Box>
      {/* ── Vault Hero Card ─────────────────────────── */}
      <Card sx={{ mb: 2.5, borderRadius: '18px', overflow: 'hidden', position: 'relative', minHeight: 180 }}>
        {/* Three.js canvas – background right side */}
        <Box sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: { xs: 160, md: 280 },
          height: '100%',
          opacity: 0.7,
          pointerEvents: 'none',
        }}>
          <Canvas camera={{ position: [0, 0, 4], fov: 50 }} gl={{ alpha: true, antialias: true }}>
            <ambientLight intensity={0.4} />
            <pointLight position={[3, 3, 3]} intensity={1.2} color="#3B82F6" />
            <pointLight position={[-3, -2, 2]} intensity={0.6} color="#8B5CF6" />
            <VaultTorus />
          </Canvas>
        </Box>

        <CardContent sx={{ p: { xs: '24px', md: '32px 40px' }, position: 'relative', zIndex: 1 }}>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#52525B', mb: 1 }}>
            Wealth Vault
          </Typography>
          <Typography sx={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: { xs: 36, md: 52 },
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: '#3B82F6',
            mb: 1,
            textShadow: '0 0 40px rgba(59,130,246,0.3)',
          }}>
            {formatCurrency(totalSaved, baseCurrency)}
          </Typography>
          <Stack direction="row" spacing={2.5} sx={{ mt: 2.5 }}>
            <Box>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, color: '#52525B', mb: 0.25 }}>
                Active goals
              </Typography>
              <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color: '#A1A1AA' }}>
                {activeGoalCount}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Header actions ──────────────────────────── */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={() => setOpenGoal(true)} startIcon={<Target size={15} />}>
          New goal
        </Button>
        <Button variant="contained" onClick={() => setOpenTxn(true)} startIcon={<Plus size={15} />}>
          Add transaction
        </Button>
      </Stack>

      {/* ── Tabs ──────────────────────────────────── */}
      <Card sx={{ mb: 2, borderRadius: '14px' }}>
        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
            <Tab value="goals" label="Goals" />
            <Tab value="transactions" label="Transactions" />
          </Tabs>
        </Box>

        {tab === 'goals' ? (
          <Box>
            {goalsQuery.isLoading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography sx={{ color: '#52525B', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14 }}>Loading…</Typography>
              </Box>
            ) : goals.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8, px: 4 }}>
                <Box sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '14px',
                  bgcolor: 'rgba(59,130,246,0.10)',
                  border: '1px solid rgba(59,130,246,0.20)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}>
                  <PiggyBank size={24} color="#3B82F6" />
                </Box>
                <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, color: '#F4F4F5', mb: 0.5 }}>
                  No goals yet
                </Typography>
                <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: '#71717A', mb: 2.5 }}>
                  Set a savings goal and stay motivated
                </Typography>
                <Button variant="contained" onClick={() => setOpenGoal(true)} startIcon={<Plus size={15} />}>
                  Create goal
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gap: 0 }}>
                {goals.map((g, idx) => {
                  const progress = progressByGoal.get(g.id) ?? 0
                  const target   = Number(g.target_amount)
                  const pct      = Math.max(0, Math.min(100, (progress / target) * 100))
                  const deadlineDate = g.deadline ? parseISO(g.deadline) : null
                  const daysLeft     = deadlineDate ? differenceInCalendarDays(deadlineDate, new Date()) : null
                  const monthly      = deadlineDate && progress < target ? calcMonthlyNeeded(progress, target, deadlineDate) : null
                  const barColor     = pct >= 100 ? '#10B981' : pct >= 70 ? '#F59E0B' : '#3B82F6'

                  return (
                    <Box key={g.id} sx={{
                      px: { xs: 2.5, md: 3 },
                      py: 2.5,
                      borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
                        <Box sx={{ flex: 1 }}>
                          {/* Name + menu */}
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
                            <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: '#F4F4F5', flex: 1 }}>
                              {g.name}
                            </Typography>
                            {pct >= 100 && (
                              <Box sx={{ px: 1, py: 0.15, borderRadius: '999px', bgcolor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                                <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 10, fontWeight: 700, color: '#10B981', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                  Reached
                                </Typography>
                              </Box>
                            )}
                            <IconButton
                              size="small"
                              onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuGoalId(g.id) }}
                              sx={{ color: '#52525B', '&:hover': { color: '#F4F4F5' } }}
                            >
                              <MoreHorizontal size={16} />
                            </IconButton>
                          </Stack>

                          {/* Progress amounts */}
                          <Stack direction="row" spacing={0.5} sx={{ mb: 1.25 }}>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: barColor, letterSpacing: '-0.02em' }}>
                              {formatCurrency(progress, g.currency)}
                            </Typography>
                            <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: '#3F3F46' }}>/</Typography>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#71717A', letterSpacing: '-0.02em' }}>
                              {formatCurrency(target, g.currency)}
                            </Typography>
                          </Stack>

                          {/* Progress bar */}
                          <Box sx={{ mb: 1 }}>
                            <Box sx={{ height: 6, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden', mb: 0.5 }}>
                              <Box sx={{
                                height: '100%',
                                width: `${pct}%`,
                                borderRadius: '999px',
                                bgcolor: barColor,
                                boxShadow: `0 0 8px ${barColor}60`,
                                transition: 'width 700ms cubic-bezier(0.4,0,0.2,1)',
                              }} />
                            </Box>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: barColor, fontWeight: 600 }}>
                              {pct.toFixed(0)}%
                            </Typography>
                          </Box>

                          {/* Meta info */}
                          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                            {monthly !== null && monthly > 0 && (
                              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: '#71717A' }}>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#A1A1AA' }}>
                                  {formatCurrency(monthly, g.currency)}
                                </span>
                                /mo needed
                              </Typography>
                            )}
                            {deadlineDate && daysLeft !== null && (
                              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: '#71717A' }}>
                                {formatDate(deadlineDate, 'long')}
                                {' · '}
                                <span style={{ color: daysLeft < 30 ? '#F59E0B' : '#A1A1AA' }}>
                                  {daysLeft > 0 ? `${daysLeft}d left` : 'Past deadline'}
                                </span>
                              </Typography>
                            )}
                          </Stack>
                        </Box>

                        {/* Actions */}
                        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                          <Button variant="contained" size="small" onClick={() => setOpenTxn(true)} sx={{ fontSize: 12, px: 1.5 }}>
                            Add funds
                          </Button>
                          <Button variant="outlined" size="small" onClick={() => setOpenTxn(true)} sx={{ fontSize: 12, px: 1.5 }}>
                            Withdraw
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>
        ) : (
          /* Transactions tab */
          <Box>
            {txnsQuery.isLoading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography sx={{ color: '#52525B', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14 }}>Loading…</Typography>
              </Box>
            ) : txns.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14, color: '#71717A' }}>
                  No savings transactions yet.
                </Typography>
              </Box>
            ) : (
              <Box>
                {txns.map((t, idx) => (
                  <Box key={t.id} sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: { xs: 2.5, md: 3 },
                    py: 1.75,
                    borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    flexWrap: 'wrap',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                    transition: 'background 120ms ease',
                  }}>
                    <Box sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      bgcolor: t.direction === 'deposit' ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
                      border: `1px solid ${t.direction === 'deposit' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <PiggyBank size={14} color={t.direction === 'deposit' ? '#10B981' : '#EF4444'} />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13.5, fontWeight: 500, color: '#D4D4D8' }}>
                        {t.goal_id
                          ? `Goal: ${goals.find((g) => g.id === t.goal_id)?.name ?? 'Unknown'}`
                          : 'General savings'}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
                        <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, color: '#52525B' }}>
                          {formatDate(t.date, 'short')} · {t.direction} · {t.source}
                        </Typography>
                      </Stack>
                    </Box>

                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: t.direction === 'deposit' ? '#10B981' : '#EF4444', letterSpacing: '-0.02em' }}>
                        {t.direction === 'deposit' ? '+' : '−'}{formatCurrency(Number(t.amount), t.currency)}
                      </Typography>
                      <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#52525B', letterSpacing: '-0.02em' }}>
                        {formatCurrency(Number(t.base_amount), t.base_currency)}
                      </Typography>
                    </Box>

                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteTxnMutation.mutate(t.id)}
                      disabled={deleteTxnMutation.isPending}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Card>

      {/* Goal context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => { setMenuAnchor(null); setMenuGoalId(null) }}
      >
        <MenuItem
          onClick={() => {
            if (menuGoalId) deleteGoalMutation.mutate(menuGoalId)
            setMenuAnchor(null)
            setMenuGoalId(null)
          }}
          sx={{ color: 'error.main', gap: 1 }}
        >
          <Trash2 size={16} />
          Delete goal
        </MenuItem>
      </Menu>

      {/* Dialogs */}
      <AddGoalDialog
        open={openGoal}
        onClose={() => setOpenGoal(false)}
        onSubmit={(v) => addGoalMutation.mutateAsync(v)}
        submitting={addGoalMutation.isPending}
        currencies={currencies}
        defaultCurrency={baseCurrency}
      />
      <AddSavingsTransactionDialog
        open={openTxn}
        onClose={() => setOpenTxn(false)}
        onSubmit={(v) => addTxnMutation.mutateAsync(v)}
        submitting={addTxnMutation.isPending}
        currencies={currencies}
        goals={goals}
        defaultCurrency={baseCurrency}
        balances={balances}
      />
    </Box>
  )
}
