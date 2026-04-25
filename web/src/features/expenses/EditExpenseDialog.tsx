import { useMemo } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, type SubmitHandler } from 'react-hook-form'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'

import type { Currency, Expense, ExpenseCategory } from '../../types/domain'

const Schema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1),
  category_id: z.string().min(1),
  payment_method: z.enum(['cash', 'online']),
  date: z.string().min(10),
  notes: z.string().optional(),
})

export type EditExpenseValues = z.infer<typeof Schema>

export function EditExpenseDialog(props: {
  open: boolean
  onClose: () => void
  onSubmit: (values: EditExpenseValues) => Promise<void>
  submitting: boolean
  currencies: Currency[]
  categories: ExpenseCategory[]
  expense: Expense
}) {
  const { open, onClose, onSubmit, submitting, currencies, categories, expense } = props

  const defaultValues = useMemo<EditExpenseValues>(
    () => ({
      amount: Number(expense.amount),
      currency: expense.currency,
      category_id: expense.category_id,
      payment_method: expense.payment_method,
      date: expense.date,
      notes: expense.notes ?? '',
    }),
    [expense],
  )

  const form = useForm<EditExpenseValues>({
    resolver: zodResolver(Schema),
    defaultValues,
  })

  const handleSubmit: SubmitHandler<EditExpenseValues> = async (values) => {
    await onSubmit(values)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Edit expense</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Changing amount/currency/date will recompute FX snapshot in your base currency.
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Amount"
              type="number"
              inputProps={{ step: '0.01', min: 0 }}
              fullWidth
              {...form.register('amount', { valueAsNumber: true })}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="currency"
              control={form.control}
              render={({ field }) => (
                <TextField select label="Currency" fullWidth {...field}>
                  {currencies.map((c) => (
                    <MenuItem key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Controller
              name="category_id"
              control={form.control}
              render={({ field }) => (
                <TextField select label="Category" fullWidth {...field}>
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id} disabled={!c.is_active}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="payment_method"
              control={form.control}
              render={({ field }) => (
                <TextField select label="Payment method" fullWidth {...field}>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Date"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              {...form.register('date')}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <TextField label="Notes" fullWidth multiline minRows={2} {...form.register('notes')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={form.handleSubmit(handleSubmit)} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
