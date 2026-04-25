export type CurrencyCode = string

export type PaymentMethod = 'cash' | 'online'

export type ThemePreference = 'light' | 'dark' | 'system'

export type UserMetadata = {
  user_id: string
  base_currency: CurrencyCode
  theme: ThemePreference
  reduce_motion: boolean
}

export type Currency = {
  code: CurrencyCode
  name: string
  symbol: string | null
  decimals: number
  is_active: boolean
}

export type ExpenseCategory = {
  id: string
  user_id: string
  name: string
  color: string | null
  icon: string | null
  is_active: boolean
}

export type IncomeCategory = ExpenseCategory

export type FxSnapshot = {
  base_currency: CurrencyCode
  base_amount: number
  fx_rate: number
  fx_date: string // YYYY-MM-DD
}

export type Expense = {
  id: string
  user_id: string
  amount: number
  currency: CurrencyCode
  category_id: string
  payment_method: PaymentMethod
  date: string // YYYY-MM-DD
  notes: string | null
  is_recurring: boolean
  recurring_id: string | null
} & FxSnapshot

export type Income = {
  id: string
  user_id: string
  amount: number
  currency: CurrencyCode
  category_id: string
  income_type: PaymentMethod
  date: string // YYYY-MM-DD
  notes: string | null
  is_recurring: boolean
  recurring_id: string | null
} & FxSnapshot

export type SavingsGoal = {
  id: string
  user_id: string
  name: string
  target_amount: number
  currency: CurrencyCode
  deadline: string | null
  status: 'active' | 'completed' | 'archived'
}

export type SavingsTransaction = {
  id: string
  user_id: string
  amount: number
  currency: CurrencyCode
  direction: 'deposit' | 'withdraw'
  source: 'cash' | 'online' | 'savings'
  date: string
  notes: string | null
  goal_id: string | null
} & FxSnapshot

export type Budget = {
  id: string
  user_id: string
  category_id: string
  month: string // YYYY-MM-01
  base_currency: CurrencyCode
  limit_amount: number
}

export type UserBalances = {
  cash_balance: number
  online_balance: number
  savings_balance: number
  base_currency: string
}

export type Notification = {
  id: string
  user_id: string
  kind: 'budget' | 'recurring' | 'system'
  severity: 'info' | 'warning' | 'error'
  title: string
  message: string | null
  dedupe_key: string | null
  is_read: boolean
  created_at: string
}


