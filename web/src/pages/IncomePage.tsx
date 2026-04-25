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
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import toast from 'react-hot-toast'
import { ArrowDownCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Filter, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

import { nhostGraphql } from '../api/nhostGraphql'
import { Queries } from '../api/queries'
import { ensureFxRate } from '../features/expenses/fx'
import { AddIncomeDialog, type AddIncomeValues } from '../features/income/AddIncomeDialog'
import { EditIncomeDialog, type EditIncomeValues } from '../features/income/EditIncomeDialog'
import { useNhost } from '../nhost/useNhost'
import type { Currency, Income, IncomeCategory, UserMetadata } from '../types/domain'
import { formatCurrency, formatDate } from '../utils/format'

export function IncomePage() {
  const { nhost, userId } = useNhost()
  const [openAdd, setOpenAdd] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | 'cash' | 'online'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [dateStart, setDateStart] = useState(() => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'))
  const [dateEnd, setDateEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; income: Income } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Income | null>(null)
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
    queryKey: ['income_categories', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ income_categories: IncomeCategory[] }, { userId: string }>(
        nhost,
        Queries.incomeCategories,
        { userId },
      )
      return data.income_categories
    },
  })

  const incomesQuery = useQuery({
    queryKey: ['incomes_page', userId, dateStart, dateEnd, typeFilter, categoryFilter, page],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const offset = page * pageSize

      if (typeFilter !== 'all' && categoryFilter !== 'all') {
        const data = await nhostGraphql<{ incomes: (Income & { created_at: string })[] }, { userId: string; start: string; end: string; incomeType: string; categoryId: string; limit: number; offset: number }>(
          nhost,
          Queries.incomesPageByBoth,
          { userId, start: dateStart, end: dateEnd, incomeType: typeFilter, categoryId: categoryFilter, limit: pageSize, offset },
        )
        return data.incomes
      }
      if (typeFilter !== 'all') {
        const data = await nhostGraphql<{ incomes: (Income & { created_at: string })[] }, { userId: string; start: string; end: string; incomeType: string; limit: number; offset: number }>(
          nhost,
          Queries.incomesPageByType,
          { userId, start: dateStart, end: dateEnd, incomeType: typeFilter, limit: pageSize, offset },
        )
        return data.incomes
      }
      if (categoryFilter !== 'all') {
        const data = await nhostGraphql<{ incomes: (Income & { created_at: string })[] }, { userId: string; start: string; end: string; categoryId: string; limit: number; offset: number }>(
          nhost,
          Queries.incomesPageByCategory,
          { userId, start: dateStart, end: dateEnd, categoryId: categoryFilter, limit: pageSize, offset },
        )
        return data.incomes
      }
      const data = await nhostGraphql<{ incomes: (Income & { created_at: string })[] }, { userId: string; start: string; end: string; limit: number; offset: number }>(
        nhost,
        Queries.incomesPageAll,
        { userId, start: dateStart, end: dateEnd, limit: pageSize, offset },
      )
      return data.incomes
    },
  })

  const baseCurrency = metadataQuery.data?.base_currency ?? 'USD'
  const currencies = currenciesQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = incomesQuery.data ?? []

  const totalBase = useMemo(() => {
    return filtered.reduce((sum, i) => sum + Number(i.base_amount || 0), 0)
  }, [filtered])

  const addMutation = useMutation({
    mutationFn: async (values: AddIncomeValues) => {
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

      await nhostGraphql(nhost, Queries.insertIncome, {
        object: {
          user_id: userId,
          amount: values.amount,
          currency: values.currency,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          fx_rate: fxRate,
          fx_date: fxDate,
          category_id: values.category_id,
          income_type: values.income_type,
          date: values.date,
          notes: values.notes?.trim() || null,
          is_recurring: false,
        },
      })
    },
    onSuccess: async () => {
      await incomesQuery.refetch()
      toast.success('Income added.')
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Failed to add income.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!nhost) throw new Error('Not configured')
      await nhostGraphql(nhost, Queries.deleteIncome, { id })
    },
    onSuccess: async () => {
      await incomesQuery.refetch()
      toast.success('Deleted.')
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Failed to delete income.')
    },
  })

  const editMutation = useMutation({
    mutationFn: async (args: { id: string; values: EditIncomeValues }) => {
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

      await nhostGraphql(nhost, Queries.updateIncome, {
        id,
        _set: {
          amount: values.amount,
          currency: values.currency,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          fx_rate: fxRate,
          fx_date: fxDate,
          category_id: values.category_id,
          income_type: values.income_type,
          date: values.date,
          notes: values.notes?.trim() || null,
        },
      })
    },
    onSuccess: async () => {
      await incomesQuery.refetch()
      toast.success('Updated.')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update.'),
  })

  return (
    <Box className="page-enter">
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography
          variant="h4"
          sx={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}
        >
          Income
        </Typography>
        <Button
          variant="contained"
          onClick={() => setOpenAdd(true)}
          startIcon={<Plus size={18} />}
        >
          Add income
        </Button>
      </Stack>

      {/* Stats bar */}
      <Box
        sx={{
          background: 'var(--color-income-bg)',
          border: '1px solid var(--color-income-border)',
          borderRadius: '10px',
          padding: '12px 20px',
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          Total this month:
        </Typography>
        <Typography
          sx={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--color-income)',
          }}
        >
          {formatCurrency(totalBase, baseCurrency)}
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: filtersOpen ? undefined : '12px !important' }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setFiltersOpen(o => !o)}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Filter size={15} style={{ color: 'var(--color-text-muted)' }} />
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>Filters</Typography>
              {(typeFilter !== 'all' || categoryFilter !== 'all') && (
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
                label="Type"
                value={typeFilter}
                onChange={(e) => {
                  setPage(0)
                  setTypeFilter(e.target.value as any)
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

      {/* Income list */}
      <Card>
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Recent income</Typography>
          <Divider sx={{ mb: 2 }} />

          {incomesQuery.isLoading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : filtered.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                gap: 1.5,
              }}
            >
              <ArrowDownCircle size={40} style={{ color: 'var(--color-text-muted)' }} />
              <Typography
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                }}
              >
                No income recorded
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                Add your first income source
              </Typography>
              <Button
                variant="contained"
                startIcon={<Plus size={16} />}
                onClick={() => setOpenAdd(true)}
                sx={{ mt: 1 }}
              >
                Add income
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gap: 1 }}>
              {filtered.map((i) => {
                const cat = categoryMap.get(i.category_id)
                return (
                  <Box
                    key={i.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      borderRadius: 2,
                      px: 1.5,
                      py: 1.25,
                      transition: 'background 0.15s',
                      '&:hover': {
                        background: 'var(--color-bg-card-alt)',
                      },
                      '& .row-menu-trigger': { opacity: 0, transition: 'opacity 0.15s' },
                      '&:hover .row-menu-trigger': { opacity: 1 },
                    }}
                  >
                    {/* Category color dot */}
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        minWidth: 40,
                        borderRadius: '50%',
                        bgcolor: cat?.color ?? 'divider',
                      }}
                    />

                    {/* Category + notes + date */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 600, fontSize: 15 }}>
                          {cat?.name ?? 'Unknown category'}
                        </Typography>
                        <Box
                          component="span"
                          sx={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'capitalize',
                            px: 1,
                            py: 0.25,
                            borderRadius: '6px',
                            bgcolor: 'action.hover',
                            color: 'text.secondary',
                            lineHeight: 1.6,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {i.income_type === 'cash' ? 'Cash' : 'Online'}
                        </Box>
                      </Stack>
                      {i.notes ? (
                        <Typography
                          sx={{
                            fontSize: 13,
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 520,
                          }}
                        >
                          {i.notes}
                        </Typography>
                      ) : null}
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                        {formatDate(i.date, 'short')}
                      </Typography>
                    </Box>

                    {/* Amount */}
                    <Box sx={{ textAlign: 'right', minWidth: 130, ml: 'auto' }}>
                      <Typography
                        sx={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: 'var(--color-income)',
                        }}
                      >
                        +{formatCurrency(Number(i.amount), i.currency)}
                      </Typography>
                      {i.currency !== i.base_currency && (
                        <Typography
                          sx={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            color: 'text.secondary',
                          }}
                        >
                          {formatCurrency(Number(i.base_amount), i.base_currency)}
                        </Typography>
                      )}
                    </Box>

                    {/* Actions menu */}
                    <IconButton
                      className="row-menu-trigger"
                      size="small"
                      onClick={(e) => setMenuAnchor({ el: e.currentTarget, income: i })}
                    >
                      <MoreHorizontal size={18} />
                    </IconButton>
                  </Box>
                )
              })}
            </Box>
          )}
        </CardContent>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', px: 2, pb: 2 }}>
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
              disabled={page === 0 || incomesQuery.isLoading}
            >
              Prev
            </Button>
            <Button
              variant="outlined"
              endIcon={<ChevronRight size={16} />}
              onClick={() => setPage((p) => p + 1)}
              disabled={filtered.length < pageSize || incomesQuery.isLoading}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Card>

      {/* Row actions popover menu */}
      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) setEditing(menuAnchor.income)
            setMenuAnchor(null)
          }}
        >
          <Pencil size={15} style={{ marginRight: 8 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) setDeleteTarget(menuAnchor.income)
            setMenuAnchor(null)
          }}
          sx={{ color: 'error.main' }}
        >
          <Trash2 size={15} style={{ marginRight: 8 }} />
          Delete
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
        <DialogTitle sx={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}>Delete income?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 14 }}>
            This will permanently delete this income record. This cannot be undone.
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

      <AddIncomeDialog
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSubmit={(values) => addMutation.mutateAsync(values)}
        submitting={addMutation.isPending}
        currencies={currencies}
        categories={categories}
        defaultCurrency={baseCurrency}
      />

      {editing ? (
        <EditIncomeDialog
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSubmit={(values) => editMutation.mutateAsync({ id: editing.id, values })}
          submitting={editMutation.isPending}
          currencies={currencies}
          categories={categories}
          income={editing}
        />
      ) : null}
    </Box>
  )
}
