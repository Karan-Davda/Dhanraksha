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

import type { Currency, SavingsGoal, UserBalances } from '../../types/domain'
import { formatCurrency } from '../../utils/format'
import { todayISODate } from '../../utils/date'

const Schema = z.object({
  direction: z.enum(['deposit', 'withdraw']),
  amount: z.number().positive(),
  currency: z.string().min(1),
  source: z.enum(['cash', 'online', 'savings']),
  goal_id: z.string().nullable(),
  date: z.string().min(10),
  notes: z.string().optional(),
})

export type AddSavingsTransactionValues = z.infer<typeof Schema>

function getAvailableBalance(
  direction: 'deposit' | 'withdraw',
  source: 'cash' | 'online' | 'savings',
  balances: UserBalances | null,
): number | null {
  if (!balances) return null
  if (direction === 'withdraw') return Number(balances.savings_balance)
  if (source === 'cash')   return Number(balances.cash_balance)
  if (source === 'online') return Number(balances.online_balance)
  return null // deposit + source=savings: internal move, no external bucket consumed
}

export function AddSavingsTransactionDialog(props: {
  open: boolean
  onClose: () => void
  onSubmit: (values: AddSavingsTransactionValues) => Promise<void>
  submitting: boolean
  currencies: Currency[]
  goals: SavingsGoal[]
  defaultCurrency: string
  balances: UserBalances | null
}) {
  const { open, onClose, onSubmit, submitting, currencies, goals, defaultCurrency, balances } = props

  const defaultValues = useMemo<AddSavingsTransactionValues>(
    () => ({
      direction: 'deposit',
      amount: 0,
      currency: defaultCurrency,
      source: 'online',
      goal_id: null,
      date: todayISODate(),
      notes: '',
    }),
    [defaultCurrency],
  )

  const form = useForm<AddSavingsTransactionValues>({
    resolver: zodResolver(Schema),
    defaultValues,
  })

  const goalId   = form.watch('goal_id')
  const direction = form.watch('direction')
  const source    = form.watch('source')
  const currency  = form.watch('currency')
  const amount    = form.watch('amount')

  useEffect(() => {
    if (!open) return
    form.reset(defaultValues)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues])

  useEffect(() => {
    if (!goalId) return
    const goal = goals.find((g) => g.id === goalId)
    if (goal) form.setValue('currency', goal.currency, { shouldValidate: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId, goals])

  const handleSubmit: SubmitHandler<AddSavingsTransactionValues> = async (values) => {
    await onSubmit(values)
    form.reset(defaultValues)
    onClose()
  }

  const currencyLocked = Boolean(goalId)

  // ── Balance constraint ────────────────────────────────────────────────
  const available     = getAvailableBalance(direction, source, balances)
  const balanceValid  = available !== null && available >= 0
  const exceedsBalance = balanceValid && Number(amount) > available
  const isSameCurrency = currency === defaultCurrency
  const isHardBlock    = exceedsBalance && isSameCurrency
  const isSoftWarn     = exceedsBalance && !isSameCurrency

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>Add savings transaction</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Deposit moves money into savings. Withdraw moves money out of savings. Link to a goal to track progress.
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="direction"
              control={form.control}
              render={({ field }) => (
                <TextField select label="Direction" fullWidth {...field}>
                  <MenuItem value="deposit">Deposit</MenuItem>
                  <MenuItem value="withdraw">Withdraw</MenuItem>
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="source"
              control={form.control}
              render={({ field }) => (
                <TextField select label="Source" fullWidth {...field}>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                  <MenuItem value="savings">Savings</MenuItem>
                </TextField>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="Amount"
              type="number"
              inputProps={{ step: '0.01', min: 0 }}
              fullWidth
              {...form.register('amount', { valueAsNumber: true })}
              error={Boolean(form.formState.errors.amount) || isHardBlock}
              helperText={
                isHardBlock
                  ? `Exceeds available ${formatCurrency(available!, defaultCurrency)}`
                  : isSoftWarn
                  ? `Available ~${formatCurrency(available!, defaultCurrency)} · limit may differ after conversion`
                  : available !== null
                  ? `Available: ${formatCurrency(available, defaultCurrency)}`
                  : form.formState.errors.amount?.message
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Controller
              name="currency"
              control={form.control}
              render={({ field }) => (
                <TextField select label="Currency" fullWidth {...field} disabled={currencyLocked}>
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
              select
              label="Goal (optional)"
              fullWidth
              value={goalId ?? ''}
              onChange={(e) => form.setValue('goal_id', e.target.value ? e.target.value : null)}
            >
              <MenuItem value="">None</MenuItem>
              {goals.map((g) => (
                <MenuItem key={g.id} value={g.id} disabled={g.status !== 'active'}>
                  {g.name} ({g.currency})
                </MenuItem>
              ))}
            </TextField>
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
        <Button
          variant="contained"
          onClick={form.handleSubmit(handleSubmit)}
          disabled={submitting || isHardBlock}
        >
          {submitting ? 'Saving…' : isHardBlock ? 'Exceeds available balance' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
