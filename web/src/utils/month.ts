import { format, startOfMonth } from 'date-fns'

export function monthStartISO(date: Date) {
  return format(startOfMonth(date), 'yyyy-MM-01')
}

export function monthLabel(date: Date) {
  return format(date, 'MMMM yyyy')
}





