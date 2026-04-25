import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Filter, MoreHorizontal, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { format } from 'date-fns'

import { nhostGraphql } from '../api/nhostGraphql'
import { Queries } from '../api/queries'
import { useNhost } from '../nhost/useNhost'
import type { Currency, Expense, ExpenseCategory, UserMetadata } from '../types/domain'
import { AddExpenseDialog, type AddExpenseValues } from '../features/expenses/AddExpenseDialog'
import { ensureFxRate } from '../features/expenses/fx'
import { EditExpenseDialog, type EditExpenseValues } from '../features/expenses/EditExpenseDialog'
import { formatCurrency, formatDate } from '../utils/format'

export function ExpensesPage() {
  const { nhost, userId } = useNhost()
  const [openAdd, setOpenAdd] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'online'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [dateStart, setDateStart] = useState(() =>
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
  )
  const [dateEnd, setDateEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; expense: Expense } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const pageSize = 25

  const currenciesQuery = useQuery({
    queryKey: ['currencies'],
    enabled: Boolean(nhost),
    queryFn: async () => {
      if (!nhost) throw new Error('Nhost not configured')
      const data = await nhostGraphql<{ currencies: Currency[] }>(nhost, Queries.currencies)
      return data.currencies.filter((c) => c.is_active)
    },
  })

  const metadataQuery = useQuery({
    queryKey: ['user_metadata', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ user_metadata_by_pk: UserMetadata | null }, { userId: string }>(
        nhost,
        Queries.userMetadata,
        { userId },
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
        nhost,
        Queries.expenseCategories,
        { userId },
      )
      return data.expense_categories
    },
  })

  const expensesQuery = useQuery({
    queryKey: ['expenses_page', userId, dateStart, dateEnd, paymentFilter, categoryFilter, page],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const offset = page * pageSize

      if (paymentFilter !== 'all' && categoryFilter !== 'all') {
        const data = await nhostGraphql<{ expenses: (Expense & { created_at: string })[] }, { userId: string; start: string; end: string; payment: string; categoryId: string; limit: number; offset: number }>(
          nhost,
          Queries.expensesPageByBoth,
          { userId, start: dateStart, end: dateEnd, payment: paymentFilter, categoryId: categoryFilter, limit: pageSize, offset },
        )
        return data.expenses
      }
      if (paymentFilter !== 'all') {
        const data = await nhostGraphql<{ expenses: (Expense & { created_at: string })[] }, { userId: string; start: string; end: string; payment: string; limit: number; offset: number }>(
          nhost,
          Queries.expensesPageByPayment,
          { userId, start: dateStart, end: dateEnd, payment: paymentFilter, limit: pageSize, offset },
        )
        return data.expenses
      }
      if (categoryFilter !== 'all') {
        const data = await nhostGraphql<{ expenses: (Expense & { created_at: string })[] }, { userId: string; start: string; end: string; categoryId: string; limit: number; offset: number }>(
          nhost,
          Queries.expensesPageByCategory,
          { userId, start: dateStart, end: dateEnd, categoryId: categoryFilter, limit: pageSize, offset },
        )
        return data.expenses
      }
      const data = await nhostGraphql<{ expenses: (Expense & { created_at: string })[] }, { userId: string; start: string; end: string; limit: number; offset: number }>(
        nhost,
        Queries.expensesPageAll,
        { userId, start: dateStart, end: dateEnd, limit: pageSize, offset },
      )
      return data.expenses
    },
  })

  const baseCurrency = metadataQuery.data?.base_currency ?? 'USD'
  const currencies = currenciesQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = expensesQuery.data ?? []

  const totalBase = useMemo(() => {
    return filtered.reduce((sum, e) => sum + Number(e.base_amount || 0), 0)
  }, [filtered])

  const addMutation = useMutation({
    mutationFn: async (values: AddExpenseValues) => {
      if (!nhost || !userId) throw new Error('Not authenticated')

      const fxDate = values.date
      const quoteCurrency = values.currency

      const fxRate = await ensureFxRate({
        nhost,
        userId,
        baseCurrency,
        quoteCurrency,
        rateDate: fxDate,
      })

      const baseAmount = quoteCurrency === baseCurrency ? values.amount : values.amount / fxRate

      await nhostGraphql(nhost, Queries.insertExpense, {
        object: {
          user_id: userId,
          amount: values.amount,
          currency: values.currency,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          fx_rate: fxRate,
          fx_date: fxDate,
          category_id: values.category_id,
          payment_method: values.payment_method,
          date: values.date,
          notes: values.notes?.trim() || null,
          is_recurring: false,
        },
      })
    },
    onSuccess: async () => {
      await expensesQuery.refetch()
      toast.success('Expense added.')
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Failed to add expense.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!nhost) throw new Error('Not configured')
      await nhostGraphql(nhost, Queries.deleteExpense, { id })
    },
    onSuccess: async () => {
      await expensesQuery.refetch()
      toast.success('Deleted.')
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Failed to delete expense.')
    },
  })

  const editMutation = useMutation({
    mutationFn: async (args: { id: string; values: EditExpenseValues }) => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const { id, values } = args

      const fxDate = values.date
      const quoteCurrency = values.currency
      const fxRate = await ensureFxRate({
        nhost,
        userId,
        baseCurrency,
        quoteCurrency,
        rateDate: fxDate,
      })
      const baseAmount = quoteCurrency === baseCurrency ? values.amount : values.amount / fxRate

      await nhostGraphql(nhost, Queries.updateExpense, {
        id,
        _set: {
          amount: values.amount,
          currency: values.currency,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          fx_rate: fxRate,
          fx_date: fxDate,
          category_id: values.category_id,
          payment_method: values.payment_method,
          date: values.date,
          notes: values.notes?.trim() || null,
        },
      })
    },
    onSuccess: async () => {
      await expensesQuery.refetch()
      toast.success('Updated.')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update.'),
  })

  return (
    <Box className="page-enter">
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography
          variant="h4"
          sx={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}
        >
          Expenses
        </Typography>
        <Button
          variant="contained"
          onClick={() => setOpenAdd(true)}
          startIcon={<Plus size={18} />}
        >
          Add expense
        </Button>
      </Stack>

      <Box
        sx={{
          background: 'var(--color-expense-bg)',
          border: '1px solid var(--color-expense-border)',
          borderRadius: '10px',
          padding: '12px 20px',
          mb: 2,
        }}
      >
        <Typography sx={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>
          Total this month: {formatCurrency(totalBase, baseCurrency)}
        </Typography>
      </Box>

      <Card className="card-hover" sx={{ mb: 2 }}>
        <CardContent sx={{ pb: filtersOpen ? undefined : '12px !important' }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setFiltersOpen(o => !o)}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Filter size={15} style={{ color: 'var(--color-text-muted)' }} />
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Filters</Typography>
              {(paymentFilter !== 'all' || categoryFilter !== 'all') && (
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'var(--color-savings)', ml: 0.5 }} />
              )}
            </Stack>
            {filtersOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </Stack>
          <Collapse in={filtersOpen}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flexWrap: 'wrap', mt: 1.5 }}>
              <TextField
                label="Start"
                type="date"
                value={dateStart}
                onChange={(e) => {
                  setPage(0)
                  setDateStart(e.target.value)
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: '100%', md: 180 } }}
              />
              <TextField
                label="End"
                type="date"
                value={dateEnd}
                onChange={(e) => {
                  setPage(0)
                  setDateEnd(e.target.value)
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: '100%', md: 180 } }}
              />
              <TextField
                select
                label="Payment"
                value={paymentFilter}
                onChange={(e) => {
                  setPage(0)
                  setPaymentFilter(e.target.value as any)
                }}
                sx={{ width: { xs: '100%', md: 220 } }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="online">Online</MenuItem>
              </TextField>

              <TextField
                select
                label="Category"
                value={categoryFilter}
                onChange={(e) => {
                  setPage(0)
                  setCategoryFilter(e.target.value)
                }}
                sx={{ width: { xs: '100%', md: 320 } }}
              >
                <MenuItem value="all">All</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Collapse>
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Recent expenses</Typography>
          <Divider sx={{ mb: 2 }} />

          {expensesQuery.isLoading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : filtered.length === 0 ? (
            <Stack sx={{ alignItems: 'center', py: 6, gap: 1.5 }}>
              <Wallet size={40} style={{ color: 'var(--color-text-muted)' }} />
              <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
                No expenses yet
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Every expense tracked is money better managed
              </Typography>
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => setOpenAdd(true)}
                sx={{ mt: 1 }}
              >
                Add expense
              </Button>
            </Stack>
          ) : (
            <Box sx={{ display: 'grid', gap: 0.5 }}>
              {filtered.map((e) => {
                const cat = categoryMap.get(e.category_id)
                return (
                  <Box
                    key={e.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      borderRadius: 2,
                      px: 2,
                      py: 1.5,
                      transition: 'background 0.15s',
                      '&:hover': { background: 'var(--color-bg-card-alt)' },
                      '&:hover .row-menu-btn': { opacity: 1 },
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        minWidth: 40,
                        borderRadius: '50%',
                        bgcolor: cat?.color ?? 'var(--color-text-muted)',
                      }}
                    />

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
                        {cat?.name ?? 'Unknown category'}
                      </Typography>
                      {e.notes ? (
                        <Typography
                          sx={{
                            fontSize: 13,
                            color: 'var(--color-text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 520,
                          }}
                        >
                          {e.notes}
                        </Typography>
                      ) : null}
                    </Box>

                    <Typography
                      sx={{
                        fontSize: 13,
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                        display: { xs: 'none', sm: 'block' },
                      }}
                    >
                      {formatDate(e.date, 'short')}
                    </Typography>

                    <Box
                      sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: 1,
                        px: 1,
                        py: 0.4,
                        borderRadius: '999px',
                        bgcolor: 'action.hover',
                        color: 'text.secondary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.payment_method === 'cash' ? 'Cash' : 'Online'}
                    </Box>

                    <Typography
                      sx={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--color-expense)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      -{formatCurrency(Number(e.amount), e.currency)}
                    </Typography>

                    <IconButton
                      className="row-menu-btn"
                      size="small"
                      onClick={(ev) => setMenuAnchor({ el: ev.currentTarget, expense: e })}
                      sx={{
                        opacity: menuAnchor?.expense.id === e.id ? 1 : 0,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <MoreHorizontal size={18} />
                    </IconButton>
                  </Box>
                )
              })}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {filtered.length > 0
                ? `Showing ${page * pageSize + 1}–${page * pageSize + filtered.length}`
                : 'No results'}
              {filtered.length === pageSize ? '+' : ''}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<ChevronLeft size={16} />}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || expensesQuery.isLoading}
              >
                Prev
              </Button>
              <Button
                variant="outlined"
                endIcon={<ChevronRight size={16} />}
                onClick={() => setPage((p) => p + 1)}
                disabled={filtered.length < pageSize || expensesQuery.isLoading}
              >
                Next
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) setEditing(menuAnchor.expense)
            setMenuAnchor(null)
          }}
        >
          <ListItemIcon><Pencil size={16} /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) setDeleteTarget(menuAnchor.expense)
            setMenuAnchor(null)
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><Trash2 size={16} color="currentColor" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' } } }}
      >
        <DialogTitle sx={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}>Delete expense?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>
            This will permanently delete this expense. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              setDeleteTarget(null)
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <AddExpenseDialog
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={(values) => addMutation.mutateAsync(values)}
        submitting={addMutation.isPending}
        currencies={currencies}
        categories={categories}
        defaultCurrency={baseCurrency}
      />

      {editing ? (
        <EditExpenseDialog
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSubmit={(values) => editMutation.mutateAsync({ id: editing.id, values })}
          submitting={editMutation.isPending}
          currencies={currencies}
          categories={categories}
          expense={editing}
        />
      ) : null}
    </Box>
  )
}
