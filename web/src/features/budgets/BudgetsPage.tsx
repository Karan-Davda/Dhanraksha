import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import toast from 'react-hot-toast'
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { BarChart3, Copy, AlertTriangle, CheckCircle2 } from 'lucide-react'

import { nhostGraphql } from '../../api/nhostGraphql'
import { Queries } from '../../api/queries'
import { useNhost } from '../../nhost/useNhost'
import type { Budget, Expense, ExpenseCategory, UserMetadata } from '../../types/domain'
import { monthLabel, monthStartISO } from '../../utils/month'
import { formatCurrency, getBudgetStatus, getBudgetStatusColor } from '../../utils/format'

type BudgetRow = {
  category: ExpenseCategory
  limit: number
  spent: number
  pct: number
  budgetId: string | null
}

const THRESHOLDS = [75, 90, 100] as const

export function BudgetsPage() {
  const { nhost, userId } = useNhost()
  const [month, setMonth] = useState(() => monthStartISO(new Date()))

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

  const categoriesQuery = useQuery({
    queryKey: ['expense_categories', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ expense_categories: ExpenseCategory[] }, { userId: string }>(
        nhost, Queries.expenseCategories, { userId },
      )
      return data.expense_categories
    },
  })

  const budgetsQuery = useQuery({
    queryKey: ['budgets', userId, month],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ budgets: Budget[] }, { userId: string; month: string }>(
        nhost, Queries.budgetsByMonth, { userId, month },
      )
      return data.budgets
    },
  })

  const expensesQuery = useQuery({
    queryKey: ['expenses', userId, month],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ expenses: (Expense & { created_at: string })[] }, { userId: string; limit: number; offset: number }>(
        nhost, Queries.expenses, { userId, limit: 2000, offset: 0 },
      )
      const start = startOfMonth(parseISO(month))
      const end   = endOfMonth(parseISO(month))
      return data.expenses.filter((e) => {
        const d = parseISO(e.date)
        return d >= start && d <= end
      })
    },
  })

  const baseCurrency = metadataQuery.data?.base_currency ?? 'USD'
  const categories   = categoriesQuery.data ?? []
  const budgets      = budgetsQuery.data ?? []
  const expenses     = expensesQuery.data ?? []

  const budgetsByCategory = useMemo(() => new Map(budgets.map((b) => [b.category_id, b])), [budgets])

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) {
      map.set(e.category_id, (map.get(e.category_id) ?? 0) + Number(e.base_amount || 0))
    }
    return map
  }, [expenses])

  const rows: BudgetRow[] = useMemo(() => {
    return categories
      .filter((c) => c.is_active)
      .map((c) => {
        const b = budgetsByCategory.get(c.id)
        const limit = Number(b?.limit_amount ?? 0)
        const spent = Number(spentByCategory.get(c.id) ?? 0)
        const pct   = limit > 0 ? Math.min(999, (spent / limit) * 100) : 0
        return { category: c, limit, spent, pct, budgetId: b?.id ?? null }
      })
      .sort((a, b) => b.pct - a.pct)
  }, [budgetsByCategory, categories, spentByCategory])

  const upsertMutation = useMutation({
    mutationFn: async (args: { categoryId: string; limit: number }) => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      await nhostGraphql(nhost, Queries.upsertBudget, {
        object: {
          user_id: userId,
          category_id: args.categoryId,
          month,
          base_currency: baseCurrency,
          limit_amount: args.limit,
        },
      })
    },
    onSuccess: async () => {
      await budgetsQuery.refetch()
      toast.success('Budget saved.')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save budget.'),
  })

  const prevMonth = useMemo(() => format(subMonths(parseISO(month), 1), 'yyyy-MM-dd'), [month])

  const prevBudgetsQuery = useQuery({
    queryKey: ['budgets_prev', userId, prevMonth],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ budgets: Budget[] }, { userId: string; month: string }>(
        nhost, Queries.budgetsByMonth, { userId, month: prevMonth },
      )
      return data.budgets
    },
  })

  const copyFromLastMonthMutation = useMutation({
    mutationFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const prevBudgets = prevBudgetsQuery.data ?? []
      if (prevBudgets.length === 0) throw new Error('No budgets found for last month.')
      for (const b of prevBudgets) {
        await nhostGraphql(nhost, Queries.upsertBudget, {
          object: {
            user_id: userId,
            category_id: b.category_id,
            month,
            base_currency: baseCurrency,
            limit_amount: b.limit_amount,
          },
        })
      }
    },
    onSuccess: async () => {
      await budgetsQuery.refetch()
      toast.success('Budgets copied from last month.')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to copy budgets.'),
  })

  const alertMutation = useMutation({
    mutationFn: async (row: BudgetRow) => {
      if (!nhost || !userId) return
      if (row.limit <= 0) return
      for (const t of THRESHOLDS) {
        if (row.pct < t) continue
        const dedupeKey = `budget:${month}:${row.category.id}:${t}`
        const severity  = t >= 100 ? 'error' : 'warning'
        const title     = `Budget ${t}%: ${row.category.name}`
        const message   = `You've spent ${formatCurrency(row.spent, baseCurrency)} out of ${formatCurrency(row.limit, baseCurrency)} for ${month}.`
        await nhostGraphql(nhost, Queries.insertNotification, {
          object: {
            user_id: userId,
            kind: 'budget',
            severity,
            title,
            message,
            dedupe_key: dedupeKey,
            is_read: false,
            data: { category_id: row.category.id, month, threshold: t, spent: row.spent, limit: row.limit, base_currency: baseCurrency },
          },
        })
      }
    },
  })

  async function runAlerts() {
    try {
      for (const row of rows) await alertMutation.mutateAsync(row)
      toast.success('Alerts checked.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to check alerts.')
    }
  }

  const overBudgetCount = rows.filter((r) => r.limit > 0 && r.pct >= 100).length
  const warningCount    = rows.filter((r) => r.limit > 0 && r.pct >= 70 && r.pct < 100).length

  return (
    <Box>
      {/* ── Header ─────────────────────────────────── */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' }, mb: 2.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 22, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em' }}>
            Budgets
          </Typography>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: '#71717A', mt: 0.25 }}>
            {monthLabel(parseISO(month))} · {baseCurrency}
          </Typography>
        </Box>
        <TextField
          type="month"
          value={month.slice(0, 7)}
          onChange={(e) => setMonth(`${e.target.value}-01`)}
          sx={{ width: { xs: '100%', md: 180 } }}
          InputLabelProps={{ shrink: true }}
        />
        <Button
          variant="outlined"
          startIcon={<Copy size={14} />}
          onClick={() => copyFromLastMonthMutation.mutate()}
          disabled={copyFromLastMonthMutation.isPending || prevBudgetsQuery.isLoading || (prevBudgetsQuery.data?.length ?? 0) === 0}
          title={(prevBudgetsQuery.data?.length ?? 0) === 0 ? 'No budgets found for last month' : 'Copy budget limits from last month'}
        >
          Copy last month
        </Button>
        <Button
          variant="outlined"
          onClick={runAlerts}
          disabled={alertMutation.isPending || rows.length === 0}
        >
          Review alerts
        </Button>
      </Stack>

      {/* ── Status bar ────────────────────────────── */}
      {(overBudgetCount > 0 || warningCount > 0) && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
          {overBudgetCount > 0 && (
            <Box sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2.5,
              py: 1.5,
              borderRadius: '12px',
              bgcolor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.20)',
            }}>
              <AlertTriangle size={16} color="#EF4444" />
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: '#EF4444', fontWeight: 500 }}>
                {overBudgetCount} {overBudgetCount === 1 ? 'category' : 'categories'} over budget
              </Typography>
            </Box>
          )}
          {warningCount > 0 && (
            <Box sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2.5,
              py: 1.5,
              borderRadius: '12px',
              bgcolor: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.20)',
            }}>
              <AlertTriangle size={16} color="#F59E0B" />
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: '#F59E0B', fontWeight: 500 }}>
                {warningCount} {warningCount === 1 ? 'category' : 'categories'} approaching limit
              </Typography>
            </Box>
          )}
        </Stack>
      )}

      {/* ── Budget rows ───────────────────────────── */}
      <Card sx={{ borderRadius: '14px' }}>
        <CardContent sx={{ p: 0 }}>
          {categoriesQuery.isLoading || budgetsQuery.isLoading || expensesQuery.isLoading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: '#52525B', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14 }}>Loading…</Typography>
            </Box>
          ) : rows.length === 0 ? (
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
                <BarChart3 size={24} color="#3B82F6" />
              </Box>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, color: '#F4F4F5', mb: 0.5 }}>
                No active expense categories
              </Typography>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: '#71717A' }}>
                Add expense categories first to set budgets
              </Typography>
            </Box>
          ) : (
            rows.map((row, idx) => {
              const hasLimit  = row.limit > 0
              const status    = hasLimit ? getBudgetStatus(row.spent, row.limit) : null
              const barColor  = status ? getBudgetStatusColor(status) : '#3B82F6'
              const remaining = row.limit - row.spent
              const isExceeded = status === 'exceeded'

              return (
                <Box
                  key={row.category.id}
                  sx={{
                    px: { xs: 2.5, md: 3 },
                    py: 2.5,
                    borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ alignItems: { md: 'center' } }}>
                    <Box sx={{ flex: 1 }}>
                      {/* Category name + status icon */}
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                        {row.category.color && (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: row.category.color, flexShrink: 0 }} />
                        )}
                        <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14.5, fontWeight: 600, color: '#F4F4F5' }}>
                          {row.category.name}
                        </Typography>
                        {isExceeded && (
                          <Box sx={{
                            px: 1,
                            py: 0.2,
                            borderRadius: '999px',
                            bgcolor: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.25)',
                          }}>
                            <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 10, fontWeight: 700, color: '#EF4444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                              Over Budget
                            </Typography>
                          </Box>
                        )}
                        {status === 'safe' && hasLimit && (
                          <CheckCircle2 size={14} color="#10B981" style={{ opacity: 0.7 }} />
                        )}
                      </Stack>

                      {/* Amounts */}
                      <Stack direction="row" spacing={0.5} sx={{ mb: 1.25 }}>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: barColor, letterSpacing: '-0.02em' }}>
                          {formatCurrency(row.spent, baseCurrency)}
                        </Typography>
                        {hasLimit && (
                          <>
                            <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: '#3F3F46' }}>
                              /
                            </Typography>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#71717A', letterSpacing: '-0.02em' }}>
                              {formatCurrency(row.limit, baseCurrency)}
                            </Typography>
                            {!isExceeded && (
                              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: '#52525B', ml: 0.5, alignSelf: 'center' }}>
                                · {formatCurrency(remaining, baseCurrency)} left
                              </Typography>
                            )}
                          </>
                        )}
                      </Stack>

                      {/* Progress bar */}
                      {hasLimit ? (
                        <Box sx={{ position: 'relative' }}>
                          <Box sx={{
                            height: 6,
                            borderRadius: '999px',
                            bgcolor: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                          }}>
                            <Box sx={{
                              height: '100%',
                              width: `${Math.min(100, row.pct)}%`,
                              borderRadius: '999px',
                              bgcolor: barColor,
                              boxShadow: `0 0 8px ${barColor}60`,
                              transition: 'width 600ms cubic-bezier(0.4,0,0.2,1)',
                            }} />
                          </Box>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: barColor, fontWeight: 600 }}>
                              {row.pct.toFixed(0)}%
                            </Typography>
                          </Stack>
                        </Box>
                      ) : (
                        <Box sx={{ height: 6, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.04)' }} />
                      )}
                    </Box>

                    {/* Limit input */}
                    <TextField
                      label="Monthly limit"
                      type="number"
                      inputProps={{ step: '0.01', min: 0 }}
                      defaultValue={row.limit || ''}
                      placeholder="Set limit"
                      sx={{ width: { xs: '100%', md: 200 } }}
                      onBlur={(e) => {
                        const next = Number(e.target.value || 0)
                        if (Number.isNaN(next)) return
                        upsertMutation.mutate({ categoryId: row.category.id, limit: next })
                      }}
                      helperText={hasLimit ? undefined : 'No limit · click to set'}
                    />
                  </Stack>
                </Box>
              )
            })
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
