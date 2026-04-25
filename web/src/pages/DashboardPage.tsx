import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { nhostGraphql } from '../api/nhostGraphql'
import { Queries } from '../api/queries'
import { useNhost } from '../nhost/useNhost'
import type { ExpenseCategory, UserMetadata } from '../types/domain'
import { lastNMonthsKeys, monthRangeForLastNMonths, currentMonthRange } from '../features/dashboard/months'
import { sumByCategory, sumByMonth } from '../features/dashboard/aggregate'
import { useCountUp } from '../hooks/useCountUp'
import { formatCurrency } from '../utils/format'

export function DashboardPage() {
  const { nhost, userId } = useNhost()
  const navigate = useNavigate()

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

  const balancesQuery = useQuery({
    queryKey: ['user_balances', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{
        user_balances_by_pk: { cash_balance: number; online_balance: number; savings_balance: number; base_currency: string } | null
      }, { userId: string }>(nhost, Queries.userBalances, { userId })
      return data.user_balances_by_pk
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

  const baseCurrency = metadataQuery.data?.base_currency ?? 'USD'
  const months = useMemo(() => lastNMonthsKeys(6), [])
  const range6 = useMemo(() => monthRangeForLastNMonths(6), [])
  const rangeThisMonth = useMemo(() => currentMonthRange(), [])

  const expenses6m = useQuery({
    queryKey: ['expenses_6m', userId, range6.start, range6.end],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ expenses: { date: string; category_id: string; base_amount: number; base_currency: string }[] }, { userId: string; start: string; end: string }>(
        nhost, Queries.expensesByDateRange, { userId, start: range6.start, end: range6.end },
      )
      return data.expenses
    },
  })

  const incomes6m = useQuery({
    queryKey: ['incomes_6m', userId, range6.start, range6.end],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ incomes: { date: string; category_id: string; base_amount: number; base_currency: string }[] }, { userId: string; start: string; end: string }>(
        nhost, Queries.incomesByDateRange, { userId, start: range6.start, end: range6.end },
      )
      return data.incomes
    },
  })

  const expensesThisMonth = useQuery({
    queryKey: ['expenses_this_month', userId, rangeThisMonth.start, rangeThisMonth.end],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ expenses: { date: string; category_id: string; base_amount: number; base_currency: string }[] }, { userId: string; start: string; end: string }>(
        nhost, Queries.expensesByDateRange, { userId, start: rangeThisMonth.start, end: rangeThisMonth.end },
      )
      return data.expenses
    },
  })

  const monthlyIncome  = useMemo(() => sumByMonth(incomes6m.data ?? [],  months), [incomes6m.data,  months])
  const monthlyExpense = useMemo(() => sumByMonth(expenses6m.data ?? [], months), [expenses6m.data, months])

  const chartData = useMemo(() => {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return months.map((m, idx) => {
      const parts = m.split('-')
      const shortMonth = monthNames[parseInt(parts[1]!, 10) - 1] ?? m
      return {
        month: shortMonth,
        income:  monthlyIncome[idx]?.total  ?? 0,
        expense: monthlyExpense[idx]?.total ?? 0,
      }
    })
  }, [months, monthlyExpense, monthlyIncome])

  const thisMonthIncome  = monthlyIncome[monthlyIncome.length - 1]?.total   ?? 0
  const thisMonthExpense = monthlyExpense[monthlyExpense.length - 1]?.total ?? 0
  const thisMonthNet     = thisMonthIncome - thisMonthExpense

  const categoryPie = useMemo(() => {
    const sums       = sumByCategory(expensesThisMonth.data ?? [])
    const categories = categoriesQuery.data ?? []
    const map = new Map(categories.map((c) => [c.id, c]))
    return sums.slice(0, 8)
      .map((s) => ({ name: map.get(s.category_id)?.name ?? 'Unknown', value: s.total, color: map.get(s.category_id)?.color ?? '#52525B' }))
      .filter((x) => x.value > 0)
  }, [categoriesQuery.data, expensesThisMonth.data])

  const pieTotalExpense = useMemo(() => categoryPie.reduce((s, c) => s + c.value, 0), [categoryPie])

  const cashBalance    = Number(balancesQuery.data?.cash_balance    ?? 0)
  const onlineBalance  = Number(balancesQuery.data?.online_balance  ?? 0)
  const savingsBalance = Number(balancesQuery.data?.savings_balance ?? 0)
  const netWorth       = cashBalance + onlineBalance + savingsBalance
  const isPositive     = netWorth >= 0

  const animatedIncome  = useCountUp(thisMonthIncome)
  const animatedExpense = useCountUp(thisMonthExpense)
  const animatedNet     = useCountUp(thisMonthNet)

  const tooltipStyle = {
    backgroundColor: '#1C1C1E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    fontSize: 13,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    color: '#F4F4F5',
  }

  return (
    <Box>
      {/* ── Net Worth Hero ───────────────────────────── */}
      <Card sx={{ mb: 2.5, borderRadius: '18px', overflow: 'hidden', position: 'relative' }}>
        {/* Hero inner glow */}
        <Box sx={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: isPositive
            ? 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <CardContent sx={{ p: { xs: '24px', md: '32px 40px' }, position: 'relative' }}>
          {/* Label row */}
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#52525B',
            }}>
              Total Net Worth
            </Typography>
            {thisMonthNet !== 0 && (
              <Box component="span" sx={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 500,
                px: 1.25,
                py: 0.4,
                borderRadius: '999px',
                bgcolor: thisMonthNet > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                color: thisMonthNet > 0 ? '#10B981' : '#EF4444',
                border: `1px solid ${thisMonthNet > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}>
                {thisMonthNet > 0 ? '↑' : '↓'} {formatCurrency(Math.abs(thisMonthNet), baseCurrency)} this month
              </Box>
            )}
          </Stack>

          {/* Hero number */}
          <Typography sx={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: { xs: 44, md: 64 },
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: isPositive ? '#10B981' : '#EF4444',
            mb: 3,
            textShadow: isPositive
              ? '0 0 40px rgba(16,185,129,0.25)'
              : '0 0 40px rgba(239,68,68,0.25)',
          }}>
            {formatCurrency(netWorth, baseCurrency)}
          </Typography>

          {/* Sub-stats */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            pt: 2.5,
          }}>
            {[
              { icon: <Banknote size={14} />, label: 'Cash',    amount: cashBalance,    color: '#A1A1AA' },
              { icon: <CreditCard size={14} />, label: 'Online',  amount: onlineBalance,  color: '#A1A1AA' },
              { icon: <PiggyBank size={14} />, label: 'Savings', amount: savingsBalance, color: '#3B82F6' },
            ].map((item, i) => (
              <Box key={item.label} sx={{
                px: { xs: 0, sm: 2 },
                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                pl: i === 0 ? 0 : undefined,
              }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ color: '#52525B' }}>{item.icon}</Box>
                  <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 500, color: '#52525B' }}>
                    {item.label}
                  </Typography>
                </Stack>
                <Typography sx={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: { xs: 13, md: 15 },
                  fontWeight: 600,
                  color: item.color,
                  letterSpacing: '-0.02em',
                }}>
                  {formatCurrency(item.amount, baseCurrency)}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* ── Summary Cards ──────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[
          {
            label: 'Income',
            sub: 'This month',
            amount: animatedIncome,
            color: '#10B981',
            bg: 'rgba(16,185,129,0.10)',
            border: 'rgba(16,185,129,0.20)',
            icon: <ArrowUpRight size={16} />,
          },
          {
            label: 'Expenses',
            sub: 'This month',
            amount: animatedExpense,
            color: '#EF4444',
            bg: 'rgba(239,68,68,0.10)',
            border: 'rgba(239,68,68,0.20)',
            icon: <ArrowDownRight size={16} />,
          },
          {
            label: 'Net Flow',
            sub: 'This month',
            amount: animatedNet,
            color: thisMonthNet >= 0 ? '#10B981' : '#EF4444',
            bg: thisMonthNet >= 0 ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
            border: thisMonthNet >= 0 ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.20)',
            icon: thisMonthNet >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />,
          },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 12, md: 4 }}>
            <Card className="card-hover" sx={{ borderRadius: '14px', height: '100%' }}>
              <CardContent sx={{ p: '20px 24px' }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {card.label}
                    </Typography>
                    <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, color: '#52525B', mt: 0.25 }}>
                      {card.sub}
                    </Typography>
                  </Box>
                  <Box sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    bgcolor: card.bg,
                    border: `1px solid ${card.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: card.color,
                  }}>
                    {card.icon}
                  </Box>
                </Stack>
                <Typography sx={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 28,
                  fontWeight: 600,
                  color: card.color,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}>
                  {formatCurrency(card.amount, baseCurrency)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Charts ─────────────────────────────────────── */}
      <Grid container spacing={2}>
        {/* Bar Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ borderRadius: '14px' }}>
            <CardContent sx={{ p: '24px' }}>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: '#F4F4F5', mb: 0.25 }}>
                Income vs Expenses
              </Typography>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: '#71717A', mb: 2.5 }}>
                Last 6 months
              </Typography>
              <Box sx={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="none" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: '#71717A' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fill: '#71717A' }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="income"  fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} name="Income" />
                    <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={28} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Donut Chart */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: '14px', height: '100%' }}>
            <CardContent sx={{ p: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: '#F4F4F5', mb: 0.25 }}>
                Spending Breakdown
              </Typography>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: '#71717A', mb: 2 }}>
                This month by category
              </Typography>

              {categoryPie.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    bgcolor: 'rgba(239,68,68,0.10)',
                    border: '1px solid rgba(239,68,68,0.20)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Wallet size={22} color="#EF4444" />
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: '#F4F4F5' }}>
                      No expenses yet
                    </Typography>
                    <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: '#71717A', mt: 0.5 }}>
                      Add your first expense to see the breakdown
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Plus size={14} />}
                    onClick={() => navigate('/expenses')}
                    sx={{ mt: 0.5 }}
                  >
                    Add expense
                  </Button>
                </Box>
              ) : (
                <>
                  <Box sx={{ width: '100%', height: 200, position: 'relative' }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Pie
                          data={categoryPie}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={82}
                          innerRadius={56}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          {categoryPie.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <Box sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                    }}>
                      <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#52525B' }}>
                        Total
                      </Typography>
                      <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, color: '#F4F4F5', letterSpacing: '-0.02em' }}>
                        {formatCurrency(pieTotalExpense, baseCurrency)}
                      </Typography>
                    </Box>
                  </Box>

                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    {categoryPie.map((cat) => (
                      <Stack key={cat.name} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: cat.color, flexShrink: 0 }} />
                        <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12.5, flex: 1, color: '#A1A1AA' }}>
                          {cat.name}
                        </Typography>
                        <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 500, color: '#D4D4D8', letterSpacing: '-0.02em' }}>
                          {formatCurrency(cat.value, baseCurrency)}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
