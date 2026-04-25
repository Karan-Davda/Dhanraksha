const BASE = 'https://api.frankfurter.dev/v1'

export type FrankfurterRateResponse = {
  amount: number
  base: string
  date: string // YYYY-MM-DD
  rates: Record<string, number>
}

export async function fetchFrankfurterRate(baseCurrency: string, quoteCurrency: string, dateISO: string): Promise<number> {
  if (baseCurrency === quoteCurrency) return 1
  const url = `${BASE}/${encodeURIComponent(dateISO)}?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(quoteCurrency)}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Frankfurter API error (${res.status}): ${baseCurrency}→${quoteCurrency} on ${dateISO}`)
  }
  const json = (await res.json()) as FrankfurterRateResponse
  const rate = json.rates?.[quoteCurrency]
  if (!rate || rate <= 0) {
    throw new Error(`No FX rate for ${baseCurrency}→${quoteCurrency} on ${dateISO}`)
  }
  return rate
}





