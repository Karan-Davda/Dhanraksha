import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, IconButton, Stack, Typography } from '@mui/material'
import { addMonths, format, parseISO, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus, PiggyBank, ArrowDownLeft } from 'lucide-react'

import { nhostGraphql } from '../api/nhostGraphql'
import { Queries } from '../api/queries'
import { monthGrid } from '../features/calendar/calendarGrid'
import { useNhost } from '../nhost/useNhost'
import { formatCurrency } from '../utils/format'
import type { UserMetadata } from '../types/domain'

type DayTotals = {
  income: number
  expense: number
  savingsDeposit: number
  savingsWithdraw: number
}

const C = {
  income:          '#10B981',
  incomeBg:        'rgba(16,185,129,0.10)',
  incomeBorder:    'rgba(16,185,129,0.20)',
  expense:         '#EF4444',
  expenseBg:       'rgba(239,68,68,0.10)',
  expenseBorder:   'rgba(239,68,68,0.20)',
  savings:         '#3B82F6',
  savingsBg:       'rgba(59,130,246,0.10)',
  savingsBorder:   'rgba(59,130,246,0.20)',
  savingsOut:      '#F59E0B',
  savingsOutBg:    'rgba(245,158,11,0.10)',
  savingsOutBorder:'rgba(245,158,11,0.20)',
  surface:         '#111113',
  surfaceHover:    '#18181b',
  border:          'rgba(255,255,255,0.06)',
  borderStrong:    'rgba(255,255,255,0.12)',
  text:            '#F4F4F5',
  muted:           '#52525B',
  dim:             '#3F3F46',
  font:            "'Plus Jakarta Sans', system-ui, sans-serif",
  mono:            "'JetBrains Mono', monospace",
}

function MetricRow({
  icon,
  label,
  amount,
  currency,
  color,
  bg,
  border,
}: {
  icon: React.ReactNode
  label: string
  amount: number
  currency: string
  color: string
  bg: string
  border: string
}) {
  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 2,
      py: 1.5,
      borderRadius: '10px',
      bgcolor: amount > 0 ? bg : 'transparent',
      border: `1px solid ${amount > 0 ? border : C.border}`,
      transition: 'all 120ms ease',
    }}>
      <Box sx={{
        width: 30,
        height: 30,
        borderRadius: '8px',
        bgcolor: amount > 0 ? bg : 'rgba(255,255,255,0.04)',
        border: `1px solid ${amount > 0 ? border : C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: amount > 0 ? color : C.muted,
        flexShrink: 0,
      }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontFamily: C.font, fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </Typography>
        <Typography sx={{ fontFamily: C.mono, fontSize: 14, fontWeight: 600, color: amount > 0 ? color : C.muted, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
          {amount > 0 ? formatCurrency(amount, currency) : '—'}
        </Typography>
      </Box>
    </Box>
  )
}

export function CalendarPage() {
  const { nhost, userId } = useNhost()
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const today = format(new Date(), 'yyyy-MM-dd')
  const todayMonth = format(new Date(), 'yyyy-MM')
  const isCurrentMonth = month === todayMonth

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

  const baseCurrency = metadataQuery.data?.base_currency ?? 'USD'

  const range = useMemo(() => {
    const start = `${month}-01`
    const endISO = format(
      new Date(parseISO(`${month}-01`).getFullYear(), parseISO(`${month}-01`).getMonth() + 1, 0),
      'yyyy-MM-dd',
    )
    return { start, end: endISO }
  }, [month])

  const incomesQuery = useQuery({
    queryKey: ['calendar_incomes', userId, range.start, range.end],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ incomes: { id: string; date: string; base_amount: number }[] }, { userId: string; start: string; end: string }>(
        nhost, Queries.incomesByDateRange, { userId, start: range.start, end: range.end },
      )
      return data.incomes
    },
  })

  const expensesQuery = useQuery({
    queryKey: ['calendar_expenses', userId, range.start, range.end],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ expenses: { id: string; date: string; base_amount: number }[] }, { userId: string; start: string; end: string }>(
        nhost, Queries.expensesByDateRange, { userId, start: range.start, end: range.end },
      )
      return data.expenses
    },
  })

  const savingsQuery = useQuery({
    queryKey: ['calendar_savings', userId, range.start, range.end],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ savings: { id: string; date: string; direction: 'deposit' | 'withdraw'; base_amount: number }[] }, { userId: string; start: string; end: string }>(
        nhost, Queries.savingsByDateRange, { userId, start: range.start, end: range.end },
      )
      return data.savings
    },
  })

  const totalsByDay = useMemo(() => {
    const map = new Map<string, DayTotals>()
    const ensure = (d: string) => {
      if (!map.has(d)) map.set(d, { income: 0, expense: 0, savingsDeposit: 0, savingsWithdraw: 0 })
      return map.get(d)!
    }
    for (const i of incomesQuery.data ?? []) ensure(i.date).income += Number(i.base_amount || 0)
    for (const e of expensesQuery.data ?? []) ensure(e.date).expense += Number(e.base_amount || 0)
    for (const s of savingsQuery.data ?? []) {
      const t = ensure(s.date)
      if (s.direction === 'deposit') t.savingsDeposit += Number(s.base_amount || 0)
      else t.savingsWithdraw += Number(s.base_amount || 0)
    }
    return map
  }, [expensesQuery.data, incomesQuery.data, savingsQuery.data])

  // Max values for proportional bar scaling
  const maxValues = useMemo(() => {
    let maxI = 0, maxE = 0, maxS = 0
    for (const t of totalsByDay.values()) {
      if (t.income > maxI) maxI = t.income
      if (t.expense > maxE) maxE = t.expense
      if (t.savingsDeposit > maxS) maxS = t.savingsDeposit
    }
    return { income: maxI || 1, expense: maxE || 1, savings: maxS || 1 }
  }, [totalsByDay])

  // Month totals for summary strip
  const monthTotals = useMemo(() => {
    let income = 0, expense = 0, savings = 0
    for (const t of totalsByDay.values()) {
      income  += t.income
      expense += t.expense
      savings += t.savingsDeposit
    }
    return { income, expense, savings }
  }, [totalsByDay])

  const weeks = useMemo(() => monthGrid(month), [month])

  const selectedTotals = totalsByDay.get(selectedDate) ?? { income: 0, expense: 0, savingsDeposit: 0, savingsWithdraw: 0 }
  const selectedNet = selectedTotals.income - selectedTotals.expense
  const hasSelectedData = selectedTotals.income > 0 || selectedTotals.expense > 0 || selectedTotals.savingsDeposit > 0 || selectedTotals.savingsWithdraw > 0

  const navigateMonth = (delta: number) => {
    const cur = parseISO(`${month}-01`)
    setMonth(format(delta > 0 ? addMonths(cur, 1) : subMonths(cur, 1), 'yyyy-MM'))
  }

  const currentMonthDate = parseISO(`${month}-01`)
  const currentMonthLabel = format(currentMonthDate, 'MMMM')
  const currentYearLabel  = format(currentMonthDate, 'yyyy')

  const selectedDateObj = parseISO(selectedDate)

  return (
    <Box>
      {/* ── Header ─────────────────────────────────────────── */}
      <Stack direction="row" sx={{ alignItems: 'center', mb: 3, gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontFamily: C.font, fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
              {currentMonthLabel}
            </Typography>
            <Typography sx={{ fontFamily: C.mono, fontSize: 14, fontWeight: 500, color: C.muted }}>
              {currentYearLabel}
            </Typography>
          </Stack>
          <Typography sx={{ fontFamily: C.font, fontSize: 13, color: C.muted, mt: 0.25 }}>
            Financial calendar
          </Typography>
        </Box>

        {/* Month controls */}
        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
          {!isCurrentMonth && (
            <Box
              component="button"
              onClick={() => { setMonth(todayMonth); setSelectedDate(today) }}
              sx={{
                px: 2, py: 0.75, mr: 0.5,
                border: `1px solid ${C.borderStrong}`,
                borderRadius: '8px',
                bgcolor: 'transparent',
                color: C.text,
                fontFamily: C.font,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 120ms ease',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              Today
            </Box>
          )}
          <IconButton
            size="small"
            onClick={() => navigateMonth(-1)}
            sx={{ color: C.muted, borderRadius: '8px', '&:hover': { color: C.text, bgcolor: 'rgba(255,255,255,0.06)' } }}
          >
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => navigateMonth(1)}
            sx={{ color: C.muted, borderRadius: '8px', '&:hover': { color: C.text, bgcolor: 'rgba(255,255,255,0.06)' } }}
          >
            <ChevronRight size={16} />
          </IconButton>
        </Stack>
      </Stack>

      {/* ── Month summary strip ─────────────────────────────── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 3 }}>
        {[
          { label: 'Month income',   value: monthTotals.income,  color: C.income,  bg: C.incomeBg,  border: C.incomeBorder },
          { label: 'Month expenses', value: monthTotals.expense, color: C.expense, bg: C.expenseBg, border: C.expenseBorder },
          { label: 'Month savings',  value: monthTotals.savings, color: C.savings, bg: C.savingsBg, border: C.savingsBorder },
        ].map((item) => (
          <Box key={item.label} sx={{
            flex: 1,
            px: 2, py: 1.25,
            borderRadius: '10px',
            bgcolor: item.value > 0 ? item.bg : 'rgba(255,255,255,0.02)',
            border: `1px solid ${item.value > 0 ? item.border : C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Typography sx={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: item.value > 0 ? item.color : C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {item.label}
            </Typography>
            <Typography sx={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: item.value > 0 ? item.color : C.dim }}>
              {item.value > 0 ? formatCurrency(item.value, baseCurrency) : '—'}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* ── Main layout ─────────────────────────────────────── */}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>

        {/* Calendar grid */}
        <Box sx={{
          flex: 1,
          borderRadius: '14px',
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
          bgcolor: C.surface,
        }}>
          {/* Day-of-week header */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: `1px solid ${C.border}`,
          }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
              <Box key={d} sx={{
                py: 1.25,
                textAlign: 'center',
                borderRight: i < 6 ? `1px solid ${C.border}` : 'none',
              }}>
                <Typography sx={{
                  fontFamily: C.font,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: i >= 5 ? C.dim : C.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                }}>
                  {d}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <Box
              key={wi}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: wi < weeks.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              {week.map((cell, ci) => {
                const t        = totalsByDay.get(cell.date)
                const isSelected = cell.date === selectedDate
                const isToday    = cell.date === today
                const dayNum     = parseISO(cell.date).getDate()
                const inPct = t ? (t.income        / maxValues.income)  : 0
                const exPct = t ? (t.expense        / maxValues.expense) : 0
                const svPct = t ? (t.savingsDeposit / maxValues.savings) : 0
                const hasData = Boolean(t && (t.income > 0 || t.expense > 0 || t.savingsDeposit > 0 || t.savingsWithdraw > 0))

                return (
                  <Box
                    key={cell.date}
                    onClick={() => setSelectedDate(cell.date)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedDate(cell.date) }}
                    sx={{
                      position: 'relative',
                      cursor: 'pointer',
                      borderRight: ci < 6 ? `1px solid ${C.border}` : 'none',
                      bgcolor: isSelected
                        ? 'rgba(59,130,246,0.07)'
                        : 'transparent',
                      outline: isSelected ? `inset 0 0 0 1px rgba(59,130,246,0.3)` : 'none',
                      minHeight: { xs: 64, sm: 76 },
                      display: 'flex',
                      flexDirection: 'column',
                      p: '8px 8px 6px',
                      opacity: cell.inMonth ? 1 : 0.3,
                      transition: 'background 100ms ease',
                      '&:hover': {
                        bgcolor: isSelected
                          ? 'rgba(59,130,246,0.09)'
                          : 'rgba(255,255,255,0.025)',
                      },
                      boxShadow: isSelected ? 'inset 0 0 0 1px rgba(59,130,246,0.30)' : 'none',
                    }}
                  >
                    {/* Day number */}
                    {isToday ? (
                      <Box sx={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        bgcolor: '#3B82F6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Typography sx={{ fontFamily: C.font, fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                          {dayNum}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography sx={{
                        fontFamily: C.font,
                        fontSize: 12,
                        fontWeight: isSelected ? 700 : 400,
                        color: isSelected ? C.text : cell.inMonth ? '#A1A1AA' : C.dim,
                        lineHeight: 1,
                      }}>
                        {dayNum}
                      </Typography>
                    )}

                    {/* Activity bars — pushed to bottom */}
                    <Box sx={{ flex: 1 }} />
                    {hasData && (
                      <Stack spacing={0.5}>
                        {inPct > 0 && (
                          <Box sx={{ height: 3, borderRadius: '2px', bgcolor: `rgba(16,185,129,0.15)`, overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', width: `${Math.max(inPct * 100, 12)}%`, bgcolor: C.income, borderRadius: '2px' }} />
                          </Box>
                        )}
                        {exPct > 0 && (
                          <Box sx={{ height: 3, borderRadius: '2px', bgcolor: `rgba(239,68,68,0.15)`, overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', width: `${Math.max(exPct * 100, 12)}%`, bgcolor: C.expense, borderRadius: '2px' }} />
                          </Box>
                        )}
                        {svPct > 0 && (
                          <Box sx={{ height: 3, borderRadius: '2px', bgcolor: `rgba(59,130,246,0.15)`, overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', width: `${Math.max(svPct * 100, 12)}%`, bgcolor: C.savings, borderRadius: '2px' }} />
                          </Box>
                        )}
                      </Stack>
                    )}
                  </Box>
                )
              })}
            </Box>
          ))}

          {/* Legend */}
          <Box sx={{ px: 2.5, py: 1.5, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 2.5 }}>
            {[
              { color: C.income,  label: 'Income'   },
              { color: C.expense, label: 'Expenses'  },
              { color: C.savings, label: 'Savings'   },
            ].map((item) => (
              <Stack key={item.label} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                <Box sx={{ width: 20, height: 3, borderRadius: '2px', bgcolor: item.color }} />
                <Typography sx={{ fontFamily: C.font, fontSize: 10.5, color: C.muted, letterSpacing: '0.05em' }}>
                  {item.label}
                </Typography>
              </Stack>
            ))}
          </Box>
        </Box>

        {/* ── Day detail panel ─────────────────────────────── */}
        <Box sx={{
          width: { xs: '100%', lg: 320 },
          borderRadius: '14px',
          border: `1px solid ${C.border}`,
          bgcolor: C.surface,
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {/* Date header */}
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2, borderBottom: `1px solid ${C.border}` }}>
            <Typography sx={{ fontFamily: C.mono, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
              {format(selectedDateObj, 'EEEE')}
            </Typography>
            <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1 }}>
              <Typography sx={{ fontFamily: C.font, fontSize: 28, fontWeight: 700, color: C.text, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {format(selectedDateObj, 'd')}
              </Typography>
              <Typography sx={{ fontFamily: C.font, fontSize: 15, fontWeight: 500, color: '#71717A' }}>
                {format(selectedDateObj, 'MMMM yyyy')}
              </Typography>
            </Stack>
            {selectedDate === today && (
              <Box sx={{
                mt: 1,
                display: 'inline-flex',
                px: 1.25,
                py: 0.25,
                borderRadius: '6px',
                bgcolor: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(59,130,246,0.25)',
              }}>
                <Typography sx={{ fontFamily: C.font, fontSize: 10.5, fontWeight: 600, color: '#60A5FA', letterSpacing: '0.06em' }}>
                  TODAY
                </Typography>
              </Box>
            )}
          </Box>

          {/* Metrics */}
          <Stack spacing={1} sx={{ p: 2 }}>
            <MetricRow
              icon={<TrendingUp size={14} />}
              label="Income"
              amount={selectedTotals.income}
              currency={baseCurrency}
              color={C.income}
              bg={C.incomeBg}
              border={C.incomeBorder}
            />
            <MetricRow
              icon={<TrendingDown size={14} />}
              label="Expenses"
              amount={selectedTotals.expense}
              currency={baseCurrency}
              color={C.expense}
              bg={C.expenseBg}
              border={C.expenseBorder}
            />
            <MetricRow
              icon={<PiggyBank size={14} />}
              label="Savings deposit"
              amount={selectedTotals.savingsDeposit}
              currency={baseCurrency}
              color={C.savings}
              bg={C.savingsBg}
              border={C.savingsBorder}
            />
            <MetricRow
              icon={<ArrowDownLeft size={14} />}
              label="Savings withdraw"
              amount={selectedTotals.savingsWithdraw}
              currency={baseCurrency}
              color={C.savingsOut}
              bg={C.savingsOutBg}
              border={C.savingsOutBorder}
            />
          </Stack>

          {/* Net flow */}
          <Box sx={{
            mx: 2, mb: 2,
            px: 2, py: 1.75,
            borderRadius: '10px',
            border: `1px solid ${
              !hasSelectedData ? C.border :
              selectedNet > 0 ? C.incomeBorder :
              selectedNet < 0 ? C.expenseBorder : C.border
            }`,
            bgcolor: !hasSelectedData ? 'transparent' :
              selectedNet > 0 ? C.incomeBg :
              selectedNet < 0 ? C.expenseBg : 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Minus size={14} color={C.muted} />
              <Typography sx={{ fontFamily: C.font, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Net flow
              </Typography>
            </Stack>
            <Typography sx={{
              fontFamily: C.mono,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: !hasSelectedData ? C.dim :
                selectedNet > 0 ? C.income :
                selectedNet < 0 ? C.expense : '#71717A',
            }}>
              {!hasSelectedData
                ? '—'
                : `${selectedNet >= 0 ? '+' : '−'}${formatCurrency(Math.abs(selectedNet), baseCurrency)}`
              }
            </Typography>
          </Box>

          {!hasSelectedData && (
            <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5, textAlign: 'center' }}>
              <Typography sx={{ fontFamily: C.font, fontSize: 12, color: C.dim }}>
                No transactions on this day
              </Typography>
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  )
}
