import { format, startOfMonth, subMonths } from 'date-fns'

export function lastNMonthsKeys(n: number, from = new Date()) {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = startOfMonth(subMonths(from, i))
    out.push(format(d, 'yyyy-MM'))
  }
  return out
}

export function monthRangeForLastNMonths(n: number, from = new Date()) {
  const start = startOfMonth(subMonths(from, n - 1))
  const end = from
  return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') }
}

export function currentMonthRange(from = new Date()) {
  const start = startOfMonth(from)
  return { start: format(start, 'yyyy-MM-dd'), end: format(from, 'yyyy-MM-dd') }
}





