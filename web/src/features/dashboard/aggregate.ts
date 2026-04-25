import { format, parseISO } from 'date-fns'

export function monthKey(dateISO: string) {
  return format(parseISO(dateISO), 'yyyy-MM')
}

export function sumByMonth<T extends { date: string; base_amount: number | string }>(
  rows: T[],
  months: string[],
) {
  const map = new Map<string, number>()
  for (const m of months) map.set(m, 0)
  for (const r of rows) {
    const key = monthKey(r.date)
    if (!map.has(key)) continue
    map.set(key, (map.get(key) ?? 0) + Number(r.base_amount || 0))
  }
  return months.map((m) => ({ month: m, total: Number((map.get(m) ?? 0).toFixed(2)) }))
}

export function sumByCategory<T extends { category_id: string; base_amount: number | string }>(rows: T[]) {
  const map = new Map<string, number>()
  for (const r of rows) {
    map.set(r.category_id, (map.get(r.category_id) ?? 0) + Number(r.base_amount || 0))
  }
  return [...map.entries()]
    .map(([category_id, total]) => ({ category_id, total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total)
}





