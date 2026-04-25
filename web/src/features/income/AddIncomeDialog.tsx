import { useEffect, useMemo } from 'react'
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

import type { Currency, IncomeCategory, PaymentMethod } from '../../types/domain'
import { todayISODate } from '../../utils/date'

const Schema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1),
  category_id: z.string().min(1),
  income_type: z.enum(['cash', 'online']),
  date: z.string().min(10),
  notes: z.string().optional(),
})

export type AddIncomeValues = z.infer<typeof Schema>

export function AddIncomeDialog(props: {
  open: boolean
  onClose: () => void
  onSubmit: (values: AddIncomeValues) => Promise<void>
  submitting: boolean
  currencies: Currency[]
  categories: IncomeCategory[]
  defaultCurrency: string
}) {
  const { open, onClose, onSubmit, submitting, currencies, categories, defaultCurrency } = props

  const defaultCategoryId = categories.find((c) => c.is_active)?.id ?? ''
  const defaultValues = useMemo<AddIncomeValues>(
    () => ({
      amount: 0,
      currency: defaultCurrency,
      category_id: defaultCategoryId,
      income_type: 'online' satisfies PaymentMethod,
      date: todayISODate(),
      notes: '',
    }),
    [defaultCategoryId, defaultCurrency],
  )

  const form = useForm<AddIncomeValues>({
    resolver: zodResolver(Schema),
    defaultValues,
  })

  useEffect(() => {
    if (!open) return
    form.reset(defaultValues)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues])

  const handleSubmit: SubmitHandler<AddIncomeValues> = async (values) => {
    await onSubmit(values)
    form.reset(defaultValues)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Add income</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Amount is recorded in the original currency and converted into your base currency for reporting.
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Amount"
              type="number"
              inputProps={{ step: '0.01', min: 0 }}
              fullWidth
              {...form.register('amount', { valueAsNumber: true })}
              error={Boolean(form.formState.errors.amount)}
              helperText={form.formState.errors.amount?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="currency"
              control={form.control}
              render={({ field }) => (
                <TextField
                  select
                  label="Currency"
                  fullWidth
                  {...field}
                  error={Boolean(form.formState.errors.currency)}
                  helperText={form.formState.errors.currency?.message}
                >
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
                <TextField
                  select
                  label="Category"
                  fullWidth
                  {...field}
                  error={Boolean(form.formState.errors.category_id)}
                  helperText={form.formState.errors.category_id?.message}
                >
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
              name="income_type"
              control={form.control}
              render={({ field }) => (
                <TextField
                  select
                  label="Type"
                  fullWidth
                  {...field}
                  error={Boolean(form.formState.errors.income_type)}
                  helperText={form.formState.errors.income_type?.message}
                >
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
              error={Boolean(form.formState.errors.date)}
              helperText={form.formState.errors.date?.message}
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
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
