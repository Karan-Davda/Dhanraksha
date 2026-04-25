import { useState } from 'react'
import { Box, Button, Card, CardContent, Divider, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material'
import { Check, Download, Moon, Monitor, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'

import { CURRENCIES } from '../data/currencies'
import { nhostGraphql } from '../api/nhostGraphql'
import { Queries } from '../api/queries'
import { fetchFrankfurterLatest } from '../fx/frankfurter'
import { useNhost } from '../nhost/useNhost'
import { useThemeMode } from '../theme/useThemeMode'

const REDUCE_MOTION_KEY = 'pfm:reduce-motion'
const FX_LAST_SYNC_KEY = 'pfm:fx-last-sync'

function applyReduceMotion(enabled: boolean) {
  if (enabled) {
    document.documentElement.setAttribute('data-reduce-motion', 'true')
  } else {
    document.documentElement.removeAttribute('data-reduce-motion')
  }
}

const themeOptions = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
  { value: 'system' as const, label: 'System', icon: Monitor },
]

export function SettingsPage() {
  const { preference, setPreference } = useThemeMode()
  const { nhost, userId } = useNhost()
  const [savingBaseCurrency, setSavingBaseCurrency] = useState(false)
  const [syncingRates, setSyncingRates] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [reduceMotion, setReduceMotionState] = useState(() => {
    return localStorage.getItem(REDUCE_MOTION_KEY) === 'true'
  })
  const [fxLastSync, setFxLastSync] = useState<string | null>(() => {
    return localStorage.getItem(FX_LAST_SYNC_KEY)
  })

  function toggleReduceMotion(enabled: boolean) {
    setReduceMotionState(enabled)
    localStorage.setItem(REDUCE_MOTION_KEY, String(enabled))
    applyReduceMotion(enabled)
  }

  const metadataQuery = useQuery({
    queryKey: ['user_metadata', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ user_metadata_by_pk: { base_currency: string } | null }, { userId: string }>(
        nhost,
        Queries.userMetadata,
        { userId },
      )
      return data.user_metadata_by_pk
    },
  })

  const baseCurrency = metadataQuery.data?.base_currency ?? 'USD'
  const currencyOptions = CURRENCIES

  async function setBaseCurrency(next: string) {
    if (!nhost || !userId) return
    setSavingBaseCurrency(true)
    try {
      await nhostGraphql( nhost, Queries.updateBaseCurrency, { userId, baseCurrency: next } )
      await metadataQuery.refetch()
      toast.success(`Base currency set to ${next}`)
      toast('Balances will recompute for transactions recorded in the new base currency.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update base currency')
    } finally {
      setSavingBaseCurrency(false)
    }
  }

  async function syncFxRates() {
    if (!nhost || !userId) return
    setSyncingRates(true)
    try {
      const latest = await fetchFrankfurterLatest(baseCurrency)
      const rateDate = latest.date

      // Remove existing rates for that day/base to avoid unique constraint conflicts.
      await nhostGraphql(nhost, Queries.deleteExchangeRatesForDate, {
        userId,
        baseCurrency,
        rateDate,
      })

      const allowed = new Set(currencyOptions.map((c) => c.code))
      const entries = Object.entries(latest.rates).filter(([quote]) => allowed.has(quote))
      const skipped = Object.keys(latest.rates).length - entries.length

      const objects = entries.map(([quote, rate]) => ({
        user_id: userId,
        base_currency: baseCurrency,
        quote_currency: quote,
        rate,
        rate_date: rateDate,
        provider: 'frankfurter',
      }))

      // Insert fresh snapshot
      await nhostGraphql(nhost, Queries.insertExchangeRates, { objects })
      const now = new Date().toLocaleString()
      localStorage.setItem(FX_LAST_SYNC_KEY, now)
      setFxLastSync(now)
      toast.success(`Exchange rates updated (${objects.length} currencies)`)
      if (skipped > 0) {
        toast(`Skipped ${skipped} currencies not present in your currencies table.`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sync FX rates')
    } finally {
      setSyncingRates(false)
    }
  }

  async function exportCsv() {
    if (!nhost || !userId) return
    setExportingCsv(true)
    try {
      const [expData, incData] = await Promise.all([
        nhostGraphql<{ expenses: { id: string; date: string; amount: number; currency: string; base_amount: number; base_currency: string; payment_method: string; notes: string | null; category_id: string }[] }, { userId: string; limit: number; offset: number }>(
          nhost, Queries.expenses, { userId, limit: 10000, offset: 0 }
        ),
        nhostGraphql<{ incomes: { id: string; date: string; amount: number; currency: string; base_amount: number; base_currency: string; income_type: string; notes: string | null; category_id: string }[] }, { userId: string; limit: number; offset: number }>(
          nhost, Queries.incomes, { userId, limit: 10000, offset: 0 }
        ),
      ])

      const expRows = expData.expenses.map(e =>
        `"expense","${e.date}","${e.amount}","${e.currency}","${e.base_amount}","${e.base_currency}","${e.payment_method}","${(e.notes ?? '').replace(/"/g, '""')}","${e.category_id}"`
      )
      const incRows = incData.incomes.map(i =>
        `"income","${i.date}","${i.amount}","${i.currency}","${i.base_amount}","${i.base_currency}","${i.income_type}","${(i.notes ?? '').replace(/"/g, '""')}","${i.category_id}"`
      )

      const header = 'type,date,amount,currency,base_amount,base_currency,method_or_type,notes,category_id'
      const csv = [header, ...expRows, ...incRows].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dhanraksha-export-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${expRows.length} expenses and ${incRows.length} income records.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportingCsv(false)
    }
  }

  return (
    <Box className="page-enter">
      <Typography
        variant="h4"
        sx={{ fontFamily: 'var(--font-display)', fontWeight: 400, mb: 3 }}
      >
        Settings
      </Typography>

      <Card
        sx={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {/* ── Appearance ── */}
          <Typography
            variant="h6"
            sx={{ fontFamily: 'var(--font-body)', fontWeight: 600, mb: 0.5 }}
          >
            Appearance
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2 }}>
            Choose how the app looks to you.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {themeOptions.map((opt) => {
              const selected = preference === opt.value
              return (
                <Box
                  key={opt.value}
                  onClick={() => setPreference(opt.value)}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    width: 110,
                    height: 90,
                    borderRadius: 'var(--radius-md)',
                    border: selected
                      ? '2px solid var(--color-brand)'
                      : '1px solid var(--color-border)',
                    background: selected ? 'rgba(26,26,26,0.06)' : 'var(--color-bg-card)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    '&:hover': {
                      borderColor: 'var(--color-brand)',
                      background: selected ? 'rgba(26,26,26,0.08)' : 'var(--color-bg-card-alt)',
                    },
                  }}
                >
                  {selected && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'var(--color-brand)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={14} color="#fff" />
                    </Box>
                  )}
                  <opt.icon
                    size={26}
                    color={selected ? 'var(--color-brand)' : 'var(--color-text-secondary)'}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: selected ? 600 : 500,
                      color: selected ? 'var(--color-brand)' : 'var(--color-text-primary)',
                    }}
                  >
                    {opt.label}
                  </Typography>
                </Box>
              )
            })}
          </Box>

          <Divider sx={{ my: 3.5, borderColor: 'var(--color-border)' }} />

          {/* ── Currency ── */}
          <Typography
            variant="h6"
            sx={{ fontFamily: 'var(--font-body)', fontWeight: 600, mb: 0.5 }}
          >
            Currency
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2 }}>
            Configure your base currency and exchange rate syncing.
          </Typography>

          <Box sx={{ display: 'grid', gap: 2, maxWidth: 420 }}>
            <TextField
              select
              label="Base currency"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              disabled={savingBaseCurrency || metadataQuery.isLoading}
              helperText="Used for budgets, balances, and converted amounts (new entries)."
              fullWidth
            >
              {currencyOptions.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </MenuItem>
              ))}
            </TextField>

            <Box>
              <Button
                variant="contained"
                onClick={syncFxRates}
                disabled={syncingRates || !nhost || !userId}
                sx={{ mb: 1 }}
              >
                {syncingRates ? 'Updating exchange rates…' : 'Update exchange rates'}
              </Button>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                Exchange rates are used to convert multi-currency transactions to your base currency.
              </Typography>
              {fxLastSync && (
                <Typography variant="body2" sx={{ color: 'var(--color-text-muted)', mt: 0.5, fontSize: 12 }}>
                  Last synced: {fxLastSync}
                </Typography>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 3.5, borderColor: 'var(--color-border)' }} />

          {/* ── Accessibility ── */}
          <Typography
            variant="h6"
            sx={{ fontFamily: 'var(--font-body)', fontWeight: 600, mb: 0.5 }}
          >
            Accessibility
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2 }}>
            Adjust motion and animation preferences.
          </Typography>

          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', maxWidth: 420 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>Reduce motion</Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                Disables page transitions and animated elements.
              </Typography>
            </Box>
            <Switch
              checked={reduceMotion}
              onChange={(e) => toggleReduceMotion(e.target.checked)}
              inputProps={{ 'aria-label': 'Reduce motion' }}
            />
          </Stack>

          <Divider sx={{ my: 3.5, borderColor: 'var(--color-border)' }} />

          {/* ── Data Export ── */}
          <Typography
            variant="h6"
            sx={{ fontFamily: 'var(--font-body)', fontWeight: 600, mb: 0.5 }}
          >
            Data export
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2 }}>
            Download all your transactions as a CSV file.
          </Typography>

          <Box>
            <Button
              variant="outlined"
              startIcon={<Download size={16} />}
              onClick={exportCsv}
              disabled={exportingCsv || !nhost || !userId}
            >
              {exportingCsv ? 'Exporting…' : 'Export all data (CSV)'}
            </Button>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 1 }}>
              Exports all expenses and income records including amounts, categories, and notes.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
