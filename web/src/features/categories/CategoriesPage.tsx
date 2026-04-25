import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import toast from 'react-hot-toast'
import { Pencil, Plus, Tags, ToggleLeft, ToggleRight } from 'lucide-react'

import { nhostGraphql } from '../../api/nhostGraphql'
import { Queries } from '../../api/queries'
import { useNhost } from '../../nhost/useNhost'
import type { ExpenseCategory, IncomeCategory } from '../../types/domain'

type CategoryType = 'expense' | 'income'

const COLOR_PRESETS = ['#1976D2', '#00BCD4', '#4CAF50', '#FF9800', '#F44336', '#7E57C2', '#26A69A']

export function CategoriesPage() {
  const { nhost, userId } = useNhost()
  const [type, setType] = useState<CategoryType>('expense')
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_PRESETS[0]!)
  const [icon, setIcon] = useState('tag')
  const [dialogOpen, setDialogOpen] = useState(false)

  const expenseCats = useQuery({
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

  const incomeCats = useQuery({
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

  const expenseRows = useMemo(() => expenseCats.data ?? [], [expenseCats.data])
  const incomeRows = useMemo(() => incomeCats.data ?? [], [incomeCats.data])

  function openAddDialog(categoryType: CategoryType) {
    setType(categoryType)
    setName('')
    setColor(COLOR_PRESETS[0]!)
    setIcon('tag')
    setDialogOpen(true)
  }

  async function addCategory() {
    if (!nhost || !userId) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Category name is required.')
      return
    }
    try {
      if (type === 'expense') {
        await nhostGraphql(nhost, Queries.insertExpenseCategory, {
          object: { user_id: userId, name: trimmed, color, icon, is_active: true },
        })
        await expenseCats.refetch()
      } else {
        await nhostGraphql(nhost, Queries.insertIncomeCategory, {
          object: { user_id: userId, name: trimmed, color, icon, is_active: true },
        })
        await incomeCats.refetch()
      }
      setName('')
      setDialogOpen(false)
      toast.success('Category added.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add category.')
    }
  }

  async function toggleActive(row: ExpenseCategory, categoryType: CategoryType) {
    if (!nhost) return
    try {
      if (categoryType === 'expense') {
        await nhostGraphql(nhost, Queries.updateExpenseCategory, { id: row.id, _set: { is_active: !row.is_active } })
        await expenseCats.refetch()
      } else {
        await nhostGraphql(nhost, Queries.updateIncomeCategory, { id: row.id, _set: { is_active: !row.is_active } })
        await incomeCats.refetch()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update category.')
    }
  }

  function renderEmptyState() {
    return (
      <Stack sx={{ alignItems: 'center', py: 5, gap: 1.5 }}>
        <Tags size={40} style={{ color: 'var(--color-text-muted)' }} />
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
          No categories yet
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Add categories to organize your finances
        </Typography>
      </Stack>
    )
  }

  function renderCategoryCard(row: ExpenseCategory, categoryType: CategoryType) {
    const disabled = !row.is_active
    return (
      <Box
        key={row.id}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          height: 60,
          borderRadius: 2,
          px: 2,
          transition: 'background 0.15s',
          opacity: disabled ? 0.45 : 1,
          '&:hover': { background: 'var(--color-bg-card-alt)' },
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            minWidth: 36,
            borderRadius: '50%',
            bgcolor: disabled ? 'action.disabledBackground' : (row.color ?? 'var(--color-text-muted)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            color: '#fff',
            fontWeight: 600,
          }}
        >
          {(row.icon ?? row.name[0] ?? '?').slice(0, 2)}
        </Box>

        <Typography sx={{ fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0 }}>
          {row.name}
        </Typography>

        <IconButton size="small" sx={{ color: 'var(--color-text-muted)' }}>
          <Pencil size={16} />
        </IconButton>

        <IconButton
          size="small"
          onClick={() => toggleActive(row, categoryType)}
          sx={{ color: row.is_active ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
          title={row.is_active ? 'Disable' : 'Enable'}
        >
          {row.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
        </IconButton>
      </Box>
    )
  }

  const bothEmpty = expenseRows.length === 0 && incomeRows.length === 0

  return (
    <Box className="page-enter">
      <Typography
        variant="h4"
        sx={{ fontFamily: 'var(--font-display)', fontWeight: 400, mb: 3 }}
      >
        Categories
      </Typography>

      {bothEmpty ? (
        <Card
          className="card-hover"
          sx={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <CardContent>
            {renderEmptyState()}
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<Plus size={18} />}
                onClick={() => openAddDialog('expense')}
              >
                Add expense category
              </Button>
              <Button
                variant="outlined"
                startIcon={<Plus size={18} />}
                onClick={() => openAddDialog('income')}
              >
                Add income category
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          {/* Expense categories column */}
          <Card
            className="card-hover"
            sx={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <CardContent>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16 }}>
                  Expense categories
                </Typography>
                <Button
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={() => openAddDialog('expense')}
                >
                  Add category
                </Button>
              </Stack>

              {expenseRows.length === 0 ? (
                renderEmptyState()
              ) : (
                <Box sx={{ display: 'grid', gap: 0.5 }}>
                  {expenseRows.map((row) => renderCategoryCard(row, 'expense'))}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Income categories column */}
          <Card
            className="card-hover"
            sx={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <CardContent>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16 }}>
                  Income categories
                </Typography>
                <Button
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={() => openAddDialog('income')}
                >
                  Add category
                </Button>
              </Stack>

              {incomeRows.length === 0 ? (
                renderEmptyState()
              ) : (
                <Box sx={{ display: 'grid', gap: 0.5 }}>
                  {incomeRows.map((row) => renderCategoryCard(row, 'income'))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Add category dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          Add {type === 'expense' ? 'expense' : 'income'} category
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries"
            fullWidth
            autoFocus
          />
          <TextField
            label="Icon (name)"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            fullWidth
          />
          <TextField
            select
            label="Color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            fullWidth
          >
            {COLOR_PRESETS.map((c) => (
              <MenuItem key={c} value={c}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c }} />
                  {c}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addCategory}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
