import { format } from 'date-fns'

export function todayISODate() {
  return format(new Date(), 'yyyy-MM-dd')
}





