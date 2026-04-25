const BASE = 'https://api.frankfurter.dev/v1'

export type FrankfurterLatestResponse = {
  amount: number
  base: string
  date: string // YYYY-MM-DD
  rates: Record<string, number>
}

export async function fetchFrankfurterLatest(baseCurrency: string): Promise<FrankfurterLatestResponse> {
  const url = `${BASE}/latest?from=${encodeURIComponent(baseCurrency)}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Frankfurter API error (${res.status})`)
  }
  return res.json() as Promise<FrankfurterLatestResponse>
}
