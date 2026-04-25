import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { CURRENCIES } from '../data/currencies'
import { nhostGraphql } from '../api/nhostGraphql'
import { Queries } from '../api/queries'
import { ensureFxRate } from '../features/expenses/fx'
import { AddExpenseDialog, type AddExpenseValues } from '../features/expenses/AddExpenseDialog'
import { EditExpenseDialog, type EditExpenseValues } from '../features/expenses/EditExpenseDialog'
import { AddIncomeDialog, type AddIncomeValues } from '../features/income/AddIncomeDialog'
import { EditIncomeDialog, type EditIncomeValues } from '../features/income/EditIncomeDialog'
import { useNhost } from '../nhost/useNhost'
import type { Expense, ExpenseCategory, Income, IncomeCategory, UserMetadata } from '../types/domain'
import { formatCurrency } from '../utils/format'
import { monthStartISO } from '../utils/month'

type LedgerEntry =
  | { kind: 'expense'; data: Expense & { created_at: string } }
  | { kind: 'income';  data: Income  & { created_at: string } }

type FilterType = 'all' | 'income' | 'expense'

type EditTarget =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income';  data: Income }
  | null

type DeleteTarget =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income';  data: Income }
  | null

export function LedgerPage() {
  const { nhost, userId } = useNhost()
  const [month, setMonth] = useState(() => monthStartISO(new Date()))
  const [filter, setFilter] = useState<FilterType>('all')

  // Dialog state
  const [openAddExpense, setOpenAddExpense] = useState(false)
  const [openAddIncome, setOpenAddIncome] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)
  const [rowMenuState, setRowMenuState] = useState<{ el: HTMLElement; entry: LedgerEntry } | null>(null)

  const start = format(startOfMonth(parseISO(month)), 'yyyy-MM-dd')
  const end   = format(endOfMonth(parseISO(month)),   'yyyy-MM-dd')

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

  const expenseCategoriesQuery = useQuery({
    queryKey: ['expense_categories', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ expense_categories: ExpenseCategory[] }, { userId: string }>(
        nhost, Queries.expenseCategories, { userId },
      )
      return data.expense_categories
    },
    throwOnError: (e) => { toast.error(`Expense categories: ${e instanceof Error ? e.message : 'Failed to load'}`); return false },
  })

  const incomeCategoriesQuery = useQuery({
    queryKey: ['income_categories', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ income_categories: IncomeCategory[] }, { userId: string }>(
        nhost, Queries.incomeCategories, { userId },
      )
      return data.income_categories
    },
    throwOnError: (e) => { toast.error(`Income categories: ${e instanceof Error ? e.message : 'Failed to load'}`); return false },
  })

  const expensesQuery = useQuery({
    queryKey: ['ledger_expenses', userId, start, end],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<
        { expenses: (Expense & { created_at: string })[] },
        { userId: string; start: string; end: string; limit: number; offset: number }
      >(nhost, Queries.expensesPageAll, { userId, start, end, limit: 500, offset: 0 })
      return data.expenses
    },
  })

  const incomesQuery = useQuery({
    queryKey: ['ledger_incomes', userId, start, end],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<
        { incomes: (Income & { created_at: string })[] },
        { userId: string; start: string; end: string; limit: number; offset: number }
      >(nhost, Queries.incomesPageAll, { userId, start, end, limit: 500, offset: 0 })
      return data.incomes
    },
  })

  const baseCurrency = metadataQuery.data?.base_currency ?? 'USD'
  const currencies = CURRENCIES
  const expenseCategories = expenseCategoriesQuery.data ?? []
  const incomeCategories  = incomeCategoriesQuery.data  ?? []
  const expenseCatMap = useMemo(() => new Map(expenseCategories.map((c) => [c.id, c])), [expenseCategories])
  const incomeCatMap  = useMemo(() => new Map(incomeCategories.map((c)  => [c.id, c])), [incomeCategories])

  const entries: LedgerEntry[] = useMemo(() => {
    const all: LedgerEntry[] = [
      ...(expensesQuery.data ?? []).map((d): LedgerEntry => ({ kind: 'expense', data: d })),
      ...(incomesQuery.data  ?? []).map((d): LedgerEntry => ({ kind: 'income',  data: d })),
    ]
    return all.sort((a, b) => {
      const dateCompare = b.data.date.localeCompare(a.data.date)
      if (dateCompare !== 0) return dateCompare
      return b.data.created_at.localeCompare(a.data.created_at)
    })
  }, [expensesQuery.data, incomesQuery.data])

  const filtered = useMemo(() => {
    if (filter === 'all') return entries
    return entries.filter((e) => e.kind === filter)
  }, [entries, filter])

  const grouped = useMemo(() => {
    const groups = new Map<string, LedgerEntry[]>()
    for (const entry of filtered) {
      const key = entry.data.date
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(entry)
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const totalIncome  = useMemo(() => (incomesQuery.data  ?? []).reduce((s, e) => s + Number(e.base_amount  ?? 0), 0), [incomesQuery.data])
  const totalExpense = useMemo(() => (expensesQuery.data ?? []).reduce((s, e) => s + Number(e.base_amount ?? 0), 0), [expensesQuery.data])
  const netFlow = totalIncome - totalExpense

  const isLoading = expensesQuery.isLoading || incomesQuery.isLoading

  // ── Mutations ────────────────────────────────────────────────

  const addExpenseMutation = useMutation({
    mutationFn: async (values: AddExpenseValues) => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const fxRate = await ensureFxRate({ nhost, userId, baseCurrency, quoteCurrency: values.currency, rateDate: values.date })
      const baseAmount = values.currency === baseCurrency ? values.amount : values.amount / fxRate
      await nhostGraphql(nhost, Queries.insertExpense, {
        object: {
          user_id: userId,
          amount: values.amount,
          currency: values.currency,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          fx_rate: fxRate,
          fx_date: values.date,
          category_id: values.category_id,
          payment_method: values.payment_method,
          date: values.date,
          notes: values.notes?.trim() || null,
          is_recurring: false,
        },
      })
    },
    onSuccess: async () => { await expensesQuery.refetch(); toast.success('Expense added.') },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add expense.'),
  })

  const editExpenseMutation = useMutation({
    mutationFn: async (args: { id: string; values: EditExpenseValues }) => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const { id, values } = args
      const fxRate = await ensureFxRate({ nhost, userId, baseCurrency, quoteCurrency: values.currency, rateDate: values.date })
      const baseAmount = values.currency === baseCurrency ? values.amount : values.amount / fxRate
      await nhostGraphql(nhost, Queries.updateExpense, {
        id,
        _set: {
          amount: values.amount,
          currency: values.currency,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          fx_rate: fxRate,
          fx_date: values.date,
          category_id: values.category_id,
          payment_method: values.payment_method,
          date: values.date,
          notes: values.notes?.trim() || null,
        },
      })
    },
    onSuccess: async () => { await expensesQuery.refetch(); toast.success('Updated.') },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update.'),
  })

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!nhost) throw new Error('Not configured')
      await nhostGraphql(nhost, Queries.deleteExpense, { id })
    },
    onSuccess: async () => { await expensesQuery.refetch(); toast.success('Deleted.') },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete.'),
  })

  const addIncomeMutation = useMutation({
    mutationFn: async (values: AddIncomeValues) => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const fxRate = await ensureFxRate({ nhost, userId, baseCurrency, quoteCurrency: values.currency, rateDate: values.date })
      const baseAmount = values.currency === baseCurrency ? values.amount : values.amount / fxRate
      await nhostGraphql(nhost, Queries.insertIncome, {
        object: {
          user_id: userId,
          amount: values.amount,
          currency: values.currency,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          fx_rate: fxRate,
          fx_date: values.date,
          category_id: values.category_id,
          income_type: values.income_type,
          date: values.date,
          notes: values.notes?.trim() || null,
          is_recurring: false,
        },
      })
    },
    onSuccess: async () => { await incomesQuery.refetch(); toast.success('Income added.') },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add income.'),
  })

  const editIncomeMutation = useMutation({
    mutationFn: async (args: { id: string; values: EditIncomeValues }) => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const { id, values } = args
      const fxRate = await ensureFxRate({ nhost, userId, baseCurrency, quoteCurrency: values.currency, rateDate: values.date })
      const baseAmount = values.currency === baseCurrency ? values.amount : values.amount / fxRate
      await nhostGraphql(nhost, Queries.updateIncome, {
        id,
        _set: {
          amount: values.amount,
          currency: values.currency,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          fx_rate: fxRate,
          fx_date: values.date,
          category_id: values.category_id,
          income_type: values.income_type,
          date: values.date,
          notes: values.notes?.trim() || null,
        },
      })
    },
    onSuccess: async () => { await incomesQuery.refetch(); toast.success('Updated.') },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update.'),
  })

  const deleteIncomeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!nhost) throw new Error('Not configured')
      await nhostGraphql(nhost, Queries.deleteIncome, { id })
    },
    onSuccess: async () => { await incomesQuery.refetch(); toast.success('Deleted.') },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete.'),
  })

  // ── Handlers ─────────────────────────────────────────────────

  function openRowMenu(el: HTMLElement, entry: LedgerEntry) {
    setRowMenuState({ el, entry })
  }

  function handleEdit() {
    if (!rowMenuState) return
    setEditTarget(rowMenuState.entry.kind === 'expense'
      ? { kind: 'expense', data: rowMenuState.entry.data as Expense }
      : { kind: 'income',  data: rowMenuState.entry.data as Income })
    setRowMenuState(null)
  }

  function handleDeletePrompt() {
    if (!rowMenuState) return
    setDeleteTarget(rowMenuState.entry.kind === 'expense'
      ? { kind: 'expense', data: rowMenuState.entry.data as Expense }
      : { kind: 'income',  data: rowMenuState.entry.data as Income })
    setRowMenuState(null)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'expense') deleteExpenseMutation.mutate(deleteTarget.data.id)
    else deleteIncomeMutation.mutate(deleteTarget.data.id)
    setDeleteTarget(null)
  }

  return (
    <Box>
      {/* ── Header ─────────────────────────────────── */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' }, mb: 2.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 22, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em' }}>
            Ledger
          </Typography>
          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: '#71717A', mt: 0.25 }}>
            All transactions in one place
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => setMonth(`${e.target.value}-01`)}
            sx={{ width: { xs: '100%', md: 180 } }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {/* Expense button */}
          <Box
            component="button"
            onClick={() => setOpenAddExpense(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              height: 56,
              borderRadius: '10px',
              border: '1px solid rgba(239,68,68,0.28)',
              bgcolor: 'rgba(239,68,68,0.08)',
              color: '#F87171',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: 'nowrap',
              transition: 'all 140ms ease',
              '&:hover': {
                bgcolor: 'rgba(239,68,68,0.14)',
                border: '1px solid rgba(239,68,68,0.45)',
                color: '#FCA5A5',
              },
              '&:active': { transform: 'scale(0.97)' },
            }}
          >
            <ArrowDownRight size={15} />
            Expense
          </Box>
          {/* Income button */}
          <Box
            component="button"
            onClick={() => setOpenAddIncome(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              height: 56,
              borderRadius: '10px',
              border: '1px solid rgba(16,185,129,0.28)',
              bgcolor: 'rgba(16,185,129,0.08)',
              color: '#34D399',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: 'nowrap',
              transition: 'all 140ms ease',
              '&:hover': {
                bgcolor: 'rgba(16,185,129,0.14)',
                border: '1px solid rgba(16,185,129,0.45)',
                color: '#6EE7B7',
              },
              '&:active': { transform: 'scale(0.97)' },
            }}
          >
            <ArrowUpRight size={15} />
            Income
          </Box>
        </Stack>
      </Stack>

      {/* ── Totals row ─────────────────────────────── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
        {[
          { label: 'Income',   amount: totalIncome,  color: '#10B981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.18)', icon: <ArrowUpRight size={14} /> },
          { label: 'Expenses', amount: totalExpense, color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.18)',  icon: <ArrowDownRight size={14} /> },
          { label: 'Net Flow', amount: Math.abs(netFlow), color: netFlow >= 0 ? '#10B981' : '#EF4444', bg: netFlow >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: netFlow >= 0 ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)', prefix: netFlow < 0 ? '−' : '' },
        ].map((item) => (
          <Box key={item.label} sx={{
            flex: 1,
            px: 2.5,
            py: 1.75,
            borderRadius: '12px',
            bgcolor: item.bg,
            border: `1px solid ${item.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Box>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 600, color: item.color, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.25 }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 600, color: item.color, letterSpacing: '-0.03em' }}>
                {item.prefix}{formatCurrency(item.amount, baseCurrency)}
              </Typography>
            </Box>
            {item.icon && (
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: item.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                {item.icon}
              </Box>
            )}
          </Box>
        ))}
      </Stack>

      {/* ── Filter toggle ───────────────────────────── */}
      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, val) => { if (val) setFilter(val as FilterType) }}
          sx={{
            bgcolor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            p: '3px',
            gap: '3px',
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: '8px !important',
              px: 2,
              py: 0.6,
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 500,
              color: '#71717A',
              textTransform: 'none',
              transition: 'all 120ms ease',
              '&.Mui-selected': {
                bgcolor: 'rgba(255,255,255,0.08)',
                color: '#F4F4F5',
                fontWeight: 600,
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="income">Income</ToggleButton>
          <ToggleButton value="expense">Expenses</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ── Transaction list ────────────────────────── */}
      <Card sx={{ borderRadius: '14px' }}>
        <CardContent sx={{ p: 0 }}>
          {isLoading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: '#52525B', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14 }}>
                Loading transactions…
              </Typography>
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 15, fontWeight: 600, color: '#A1A1AA', mb: 0.5 }}>
                No transactions
              </Typography>
              <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, color: '#52525B', mb: 2 }}>
                {filter === 'all' ? 'No transactions found for this period' : `No ${filter} entries for this period`}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ArrowDownRight size={14} />}
                  onClick={() => setOpenAddExpense(true)}
                  sx={{ fontSize: 12, borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444', '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239,68,68,0.06)' } }}
                >
                  Add Expense
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ArrowUpRight size={14} />}
                  onClick={() => setOpenAddIncome(true)}
                  sx={{ fontSize: 12, borderColor: 'rgba(16,185,129,0.3)', color: '#10B981', '&:hover': { borderColor: '#10B981', bgcolor: 'rgba(16,185,129,0.06)' } }}
                >
                  Add Income
                </Button>
              </Stack>
            </Box>
          ) : (
            grouped.map(([date, items], groupIdx) => (
              <Box key={date}>
                {/* Date header */}
                <Box sx={{
                  px: 3,
                  py: 1.25,
                  borderTop: groupIdx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <Typography sx={{
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: '#52525B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    {format(parseISO(date), 'EEE, MMM d')}
                  </Typography>
                </Box>

                {/* Entries for this date */}
                {items.map((entry, idx) => {
                  const isExpense = entry.kind === 'expense'
                  const amount    = Number(entry.data.base_amount ?? 0)
                  const catMap    = isExpense ? expenseCatMap : incomeCatMap
                  const cat       = catMap.get(entry.data.category_id)
                  const color     = isExpense ? '#EF4444' : '#10B981'
                  const sign      = isExpense ? '−' : '+'
                  const isMenuOpen = rowMenuState?.entry.data.id === entry.data.id && rowMenuState.entry.kind === entry.kind

                  return (
                    <Box
                      key={`${entry.kind}-${entry.data.id}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 3,
                        py: 1.5,
                        gap: 2,
                        borderTop: idx === 0 ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(255,255,255,0.03)',
                        transition: 'background 120ms ease',
                        cursor: 'default',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                        '&:hover .row-action-btn': { opacity: 1 },
                      }}
                    >
                      {/* Type icon */}
                      <Box sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        bgcolor: isExpense ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)',
                        border: `1px solid ${isExpense ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color,
                        flexShrink: 0,
                      }}>
                        {isExpense ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                      </Box>

                      {/* Category + notes */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
                          {cat && (
                            <Chip
                              label={cat.name}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: 11,
                                fontWeight: 600,
                                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                                bgcolor: cat.color ? `${cat.color}18` : 'rgba(255,255,255,0.06)',
                                color: cat.color ?? '#A1A1AA',
                                border: `1px solid ${cat.color ? `${cat.color}30` : 'rgba(255,255,255,0.08)'}`,
                                '& .MuiChip-label': { px: 1 },
                              }}
                            />
                          )}
                          {entry.data.notes && (
                            <Typography sx={{
                              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                              fontSize: 13,
                              color: '#71717A',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {entry.data.notes}
                            </Typography>
                          )}
                        </Stack>
                        <Stack direction="row" spacing={0.75} sx={{ mt: 0.25, alignItems: 'center' }}>
                          <Typography sx={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 11, color: '#3F3F46' }}>
                            {isExpense
                              ? (entry.data as Expense).payment_method
                              : (entry.data as Income).income_type}
                          </Typography>
                          {entry.data.currency !== baseCurrency && (
                            <Typography sx={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#3F3F46' }}>
                              {entry.data.currency} {Number(entry.data.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </Typography>
                          )}
                        </Stack>
                      </Box>

                      {/* Amount */}
                      <Typography sx={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 14.5,
                        fontWeight: 600,
                        color,
                        letterSpacing: '-0.02em',
                        flexShrink: 0,
                      }}>
                        {sign}{formatCurrency(amount, baseCurrency)}
                      </Typography>

                      {/* Row actions */}
                      <IconButton
                        className="row-action-btn"
                        size="small"
                        onClick={(e) => openRowMenu(e.currentTarget, entry)}
                        sx={{
                          opacity: isMenuOpen ? 1 : 0,
                          transition: 'opacity 120ms ease',
                          width: 28,
                          height: 28,
                          borderRadius: '7px',
                          color: '#52525B',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#A1A1AA' },
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </IconButton>
                    </Box>
                  )
                })}
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Row context menu ────────────────────────── */}
      <Menu
        anchorEl={rowMenuState?.el}
        open={Boolean(rowMenuState)}
        onClose={() => setRowMenuState(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 140,
              p: '4px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: '#1C1C1E',
              backgroundImage: 'none',
            },
          },
        }}
      >
        <MenuItem onClick={handleEdit} sx={{ borderRadius: '7px', gap: 1, fontSize: 13.5, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
          <ListItemIcon sx={{ minWidth: 20 }}><Pencil size={14} /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeletePrompt} sx={{ borderRadius: '7px', gap: 1, fontSize: 13.5, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: '#EF4444' }}>
          <ListItemIcon sx={{ minWidth: 20, color: 'inherit' }}><Trash2 size={14} /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* ── Delete confirmation ─────────────────────── */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          Delete {deleteTarget?.kind === 'expense' ? 'expense' : 'income'}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>
            This will permanently delete this record. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteExpenseMutation.isPending || deleteIncomeMutation.isPending}
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Expense dialog ──────────────────────── */}
      <AddExpenseDialog
        open={openAddExpense}
        onClose={() => setOpenAddExpense(false)}
        onSubmit={(values) => addExpenseMutation.mutateAsync(values)}
        submitting={addExpenseMutation.isPending}
        currencies={currencies}
        categories={expenseCategories}
        defaultCurrency={baseCurrency}
      />

      {/* ── Add Income dialog ───────────────────────── */}
      <AddIncomeDialog
        open={openAddIncome}
        onClose={() => setOpenAddIncome(false)}
        onSubmit={(values) => addIncomeMutation.mutateAsync(values)}
        submitting={addIncomeMutation.isPending}
        currencies={currencies}
        categories={incomeCategories}
        defaultCurrency={baseCurrency}
      />

      {/* ── Edit Expense dialog ─────────────────────── */}
      {editTarget?.kind === 'expense' && (
        <EditExpenseDialog
          open
          onClose={() => setEditTarget(null)}
          onSubmit={(values) => editExpenseMutation.mutateAsync({ id: editTarget.data.id, values })}
          submitting={editExpenseMutation.isPending}
          currencies={currencies}
          categories={expenseCategories}
          expense={editTarget.data}
        />
      )}

      {/* ── Edit Income dialog ──────────────────────── */}
      {editTarget?.kind === 'income' && (
        <EditIncomeDialog
          open
          onClose={() => setEditTarget(null)}
          onSubmit={(values) => editIncomeMutation.mutateAsync({ id: editTarget.data.id, values })}
          submitting={editIncomeMutation.isPending}
          currencies={currencies}
          categories={incomeCategories}
          income={editTarget.data}
        />
      )}
    </Box>
  )
}
