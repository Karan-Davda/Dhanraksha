import { format, formatDistanceToNow, parseISO, differenceInCalendarDays } from 'date-fns'

export function formatCurrency(amount: number, currency: string): string {
  const abs = Math.abs(amount)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currency} ${formatted}`
}

export function formatDate(date: string | Date, style: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  switch (style) {
    case 'short':
      return format(d, 'MMM d')
    case 'long':
      return format(d, 'MMMM d, yyyy')
    case 'relative':
      return formatDistanceToNow(d, { addSuffix: true })
  }
}

export function formatMonth(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMMM yyyy')
}

export function calcMonthlyNeeded(current: number, target: number, deadline: Date): number {
  const remaining = target - current
  if (remaining <= 0) return 0
  const daysLeft = differenceInCalendarDays(deadline, new Date())
  if (daysLeft <= 0) return remaining
  const monthsLeft = daysLeft / 30.44
  if (monthsLeft < 1) return remaining
  return remaining / monthsLeft
}

export type BudgetStatus = 'safe' | 'warning' | 'danger' | 'exceeded'

export function getBudgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return 'safe'
  const pct = (spent / limit) * 100
  if (pct >= 100) return 'exceeded'
  if (pct >= 95) return 'danger'
  if (pct >= 70) return 'warning'
  return 'safe'
}

export function getBudgetStatusColor(status: BudgetStatus): string {
  switch (status) {
    case 'safe':     return '#10B981'
    case 'warning':  return '#F59E0B'
    case 'danger':   return '#EF4444'
    case 'exceeded': return '#EF4444'
  }
}
