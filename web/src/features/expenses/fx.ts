import type { NhostClient } from '@nhost/nhost-js'

import { nhostGraphql } from '../../api/nhostGraphql'
import { Queries } from '../../api/queries'
import { fetchFrankfurterRate } from '../../fx/frankfurterRate'

type ExchangeRateRow = { id: string; rate: number; rate_date: string }

export async function ensureFxRate(args: {
  nhost: NhostClient
  userId: string
  baseCurrency: string
  quoteCurrency: string
  rateDate: string // YYYY-MM-DD
}): Promise<number> {
  const { nhost, userId, baseCurrency, quoteCurrency, rateDate } = args
  if (baseCurrency === quoteCurrency) return 1

  const existing = await nhostGraphql<{ exchange_rates: ExchangeRateRow[] }, { userId: string; baseCurrency: string; quoteCurrency: string; rateDate: string }>(
    nhost,
    Queries.exchangeRate,
    { userId, baseCurrency, quoteCurrency, rateDate },
  )

  const row = existing.exchange_rates[0]
  if (row?.rate) return row.rate

  // Not in DB yet – fetch from Frankfurter and store for this user/date.
  const rate = await fetchFrankfurterRate(baseCurrency, quoteCurrency, rateDate)
  await nhostGraphql(nhost, Queries.insertExchangeRates, {
    objects: [
      {
        user_id: userId,
        base_currency: baseCurrency,
        quote_currency: quoteCurrency,
        rate,
        rate_date: rateDate,
        provider: 'frankfurter',
      },
    ],
  })

  return rate
}





