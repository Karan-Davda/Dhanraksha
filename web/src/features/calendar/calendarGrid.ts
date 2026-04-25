import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'

export type CalendarCell = {
  date: string // YYYY-MM-DD
  inMonth: boolean
}

export function monthGrid(monthISO: string) {
  const monthStart = startOfMonth(parseISO(`${monthISO}-01`))
  const monthEnd = endOfMonth(monthStart)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const cells: CalendarCell[] = []
  let cur = gridStart
  while (cur <= gridEnd) {
    const d = format(cur, 'yyyy-MM-dd')
    cells.push({
      date: d,
      inMonth: format(cur, 'yyyy-MM') === format(monthStart, 'yyyy-MM'),
    })
    cur = addDays(cur, 1)
  }

  const weeks: CalendarCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}





