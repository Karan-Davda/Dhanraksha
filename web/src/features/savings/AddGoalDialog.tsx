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

import type { Currency } from '../../types/domain'

const Schema = z.object({
  name: z.string().min(1, 'Name is required.').max(60),
  target_amount: z.number().positive(),
  currency: z.string().min(1),
  deadline: z.string().optional(),
})

export type AddGoalValues = z.infer<typeof Schema>

export function AddGoalDialog(props: {
  open: boolean
  onClose: () => void
  onSubmit: (values: AddGoalValues) => Promise<void>
  submitting: boolean
  currencies: Currency[]
  defaultCurrency: string
}) {
  const { open, onClose, onSubmit, submitting, currencies, defaultCurrency } = props

  const defaultValues = useMemo<AddGoalValues>(
    () => ({
      name: '',
      target_amount: 0,
      currency: defaultCurrency,
      deadline: '',
    }),
    [defaultCurrency],
  )

  const form = useForm<AddGoalValues>({
    resolver: zodResolver(Schema),
    defaultValues,
  })

  useEffect(() => {
    if (!open) return
    form.reset(defaultValues)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues])

  const handleSubmit: SubmitHandler<AddGoalValues> = async (values) => {
    await onSubmit(values)
    form.reset(defaultValues)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Create savings goal</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Track progress by linking savings deposits/withdrawals to this goal.
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="Goal name"
              fullWidth
              placeholder="e.g. Emergency Fund"
              {...form.register('name')}
              error={Boolean(form.formState.errors.name)}
              helperText={form.formState.errors.name?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Target amount"
              type="number"
              inputProps={{ step: '0.01', min: 0 }}
              fullWidth
              {...form.register('target_amount', { valueAsNumber: true })}
              error={Boolean(form.formState.errors.target_amount)}
              helperText={form.formState.errors.target_amount?.message}
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
            <TextField
              label="Deadline (optional)"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
              {...form.register('deadline')}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={form.handleSubmit(handleSubmit)} disabled={submitting}>
          {submitting ? 'Saving…' : 'Create goal'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
