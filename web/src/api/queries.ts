export const Queries = {
  currencies: `
    query Currencies {
      currencies(order_by: { code: asc }) {
        code
        name
        symbol
        decimals
        is_active
      }
    }
  `,
  userMetadata: `
    query UserMetadata($userId: uuid!) {
      user_metadata_by_pk(user_id: $userId) {
        user_id
        base_currency
        theme
        reduce_motion
      }
    }
  `,
  updateBaseCurrency: `
    mutation UpdateBaseCurrency($userId: uuid!, $baseCurrency: String!) {
      update_user_metadata_by_pk(
        pk_columns: { user_id: $userId }
        _set: { base_currency: $baseCurrency }
      ) {
        user_id
        base_currency
      }
      update_user_balances_by_pk(
        pk_columns: { user_id: $userId }
        _set: { base_currency: $baseCurrency }
      ) {
        user_id
        base_currency
      }
    }
  `,
  deleteExchangeRatesForDate: `
    mutation DeleteRates($userId: uuid!, $baseCurrency: String!, $rateDate: date!) {
      delete_exchange_rates(
        where: {
          user_id: { _eq: $userId }
          base_currency: { _eq: $baseCurrency }
          rate_date: { _eq: $rateDate }
        }
      ) {
        affected_rows
      }
    }
  `,
  insertExchangeRates: `
    mutation InsertRates($objects: [exchange_rates_insert_input!]!) {
      insert_exchange_rates(objects: $objects) {
        affected_rows
      }
    }
  `,
  expenseCategories: `
    query ExpenseCategories($userId: uuid!) {
      expense_categories(
        where: { user_id: { _eq: $userId } }
        order_by: { name: asc }
      ) {
        id
        user_id
        name
        color
        icon
        is_active
      }
    }
  `,
  incomeCategories: `
    query IncomeCategories($userId: uuid!) {
      income_categories(
        where: { user_id: { _eq: $userId } }
        order_by: { name: asc }
      ) {
        id
        user_id
        name
        color
        icon
        is_active
      }
    }
  `,
  insertExpenseCategory: `
    mutation InsertExpenseCategory($object: expense_categories_insert_input!) {
      insert_expense_categories_one(object: $object) {
        id
      }
    }
  `,
  updateExpenseCategory: `
    mutation UpdateExpenseCategory($id: uuid!, $_set: expense_categories_set_input!) {
      update_expense_categories_by_pk(pk_columns: { id: $id }, _set: $_set) {
        id
      }
    }
  `,
  deleteExpenseCategory: `
    mutation DeleteExpenseCategory($id: uuid!) {
      delete_expense_categories_by_pk(id: $id) {
        id
      }
    }
  `,
  insertIncomeCategory: `
    mutation InsertIncomeCategory($object: income_categories_insert_input!) {
      insert_income_categories_one(object: $object) {
        id
      }
    }
  `,
  updateIncomeCategory: `
    mutation UpdateIncomeCategory($id: uuid!, $_set: income_categories_set_input!) {
      update_income_categories_by_pk(pk_columns: { id: $id }, _set: $_set) {
        id
      }
    }
  `,
  deleteIncomeCategory: `
    mutation DeleteIncomeCategory($id: uuid!) {
      delete_income_categories_by_pk(id: $id) {
        id
      }
    }
  `,
  exchangeRate: `
    query ExchangeRate($userId: uuid!, $baseCurrency: String!, $quoteCurrency: String!, $rateDate: date!) {
      exchange_rates(
        where: {
          user_id: { _eq: $userId }
          base_currency: { _eq: $baseCurrency }
          quote_currency: { _eq: $quoteCurrency }
          rate_date: { _eq: $rateDate }
        }
        limit: 1
      ) {
        id
        rate
        rate_date
      }
    }
  `,
  expenses: `
    query Expenses($userId: uuid!, $limit: Int!, $offset: Int!) {
      expenses(
        where: { user_id: { _eq: $userId } }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        payment_method
        date
        notes
        is_recurring
        recurring_id
        created_at
      }
    }
  `,
  expensesPageAll: `
    query ExpensesPageAll($userId: uuid!, $start: date!, $end: date!, $limit: Int!, $offset: Int!) {
      expenses(
        where: { user_id: { _eq: $userId }, date: { _gte: $start, _lte: $end } }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        payment_method
        date
        notes
        is_recurring
        recurring_id
        created_at
      }
    }
  `,
  expensesPageByPayment: `
    query ExpensesPageByPayment($userId: uuid!, $start: date!, $end: date!, $payment: String!, $limit: Int!, $offset: Int!) {
      expenses(
        where: { user_id: { _eq: $userId }, date: { _gte: $start, _lte: $end }, payment_method: { _eq: $payment } }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        payment_method
        date
        notes
        created_at
      }
    }
  `,
  expensesPageByCategory: `
    query ExpensesPageByCategory($userId: uuid!, $start: date!, $end: date!, $categoryId: uuid!, $limit: Int!, $offset: Int!) {
      expenses(
        where: { user_id: { _eq: $userId }, date: { _gte: $start, _lte: $end }, category_id: { _eq: $categoryId } }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        payment_method
        date
        notes
        created_at
      }
    }
  `,
  expensesPageByBoth: `
    query ExpensesPageByBoth($userId: uuid!, $start: date!, $end: date!, $payment: String!, $categoryId: uuid!, $limit: Int!, $offset: Int!) {
      expenses(
        where: {
          user_id: { _eq: $userId }
          date: { _gte: $start, _lte: $end }
          payment_method: { _eq: $payment }
          category_id: { _eq: $categoryId }
        }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        payment_method
        date
        notes
        created_at
      }
    }
  `,
  insertExpense: `
    mutation InsertExpense($object: expenses_insert_input!) {
      insert_expenses_one(object: $object) {
        id
      }
    }
  `,
  updateExpense: `
    mutation UpdateExpense($id: uuid!, $_set: expenses_set_input!) {
      update_expenses_by_pk(pk_columns: { id: $id }, _set: $_set) {
        id
      }
    }
  `,
  deleteExpense: `
    mutation DeleteExpense($id: uuid!) {
      delete_expenses_by_pk(id: $id) {
        id
      }
    }
  `,
  incomes: `
    query Incomes($userId: uuid!, $limit: Int!, $offset: Int!) {
      incomes(
        where: { user_id: { _eq: $userId } }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        income_type
        date
        notes
        is_recurring
        recurring_id
        created_at
      }
    }
  `,
  incomesPageAll: `
    query IncomesPageAll($userId: uuid!, $start: date!, $end: date!, $limit: Int!, $offset: Int!) {
      incomes(
        where: { user_id: { _eq: $userId }, date: { _gte: $start, _lte: $end } }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        income_type
        date
        notes
        created_at
      }
    }
  `,
  incomesPageByType: `
    query IncomesPageByType($userId: uuid!, $start: date!, $end: date!, $incomeType: String!, $limit: Int!, $offset: Int!) {
      incomes(
        where: { user_id: { _eq: $userId }, date: { _gte: $start, _lte: $end }, income_type: { _eq: $incomeType } }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        income_type
        date
        notes
        created_at
      }
    }
  `,
  incomesPageByCategory: `
    query IncomesPageByCategory($userId: uuid!, $start: date!, $end: date!, $categoryId: uuid!, $limit: Int!, $offset: Int!) {
      incomes(
        where: { user_id: { _eq: $userId }, date: { _gte: $start, _lte: $end }, category_id: { _eq: $categoryId } }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        income_type
        date
        notes
        created_at
      }
    }
  `,
  incomesPageByBoth: `
    query IncomesPageByBoth($userId: uuid!, $start: date!, $end: date!, $incomeType: String!, $categoryId: uuid!, $limit: Int!, $offset: Int!) {
      incomes(
        where: {
          user_id: { _eq: $userId }
          date: { _gte: $start, _lte: $end }
          income_type: { _eq: $incomeType }
          category_id: { _eq: $categoryId }
        }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        category_id
        income_type
        date
        notes
        created_at
      }
    }
  `,
  insertIncome: `
    mutation InsertIncome($object: incomes_insert_input!) {
      insert_incomes_one(object: $object) {
        id
      }
    }
  `,
  updateIncome: `
    mutation UpdateIncome($id: uuid!, $_set: incomes_set_input!) {
      update_incomes_by_pk(pk_columns: { id: $id }, _set: $_set) {
        id
      }
    }
  `,
  deleteIncome: `
    mutation DeleteIncome($id: uuid!) {
      delete_incomes_by_pk(id: $id) {
        id
      }
    }
  `,
  savingsGoals: `
    query SavingsGoals($userId: uuid!) {
      savings_goals(
        where: { user_id: { _eq: $userId } }
        order_by: [{ status: asc }, { created_at: desc }]
      ) {
        id
        user_id
        name
        target_amount
        currency
        deadline
        status
        created_at
      }
    }
  `,
  insertSavingsGoal: `
    mutation InsertSavingsGoal($object: savings_goals_insert_input!) {
      insert_savings_goals_one(object: $object) {
        id
      }
    }
  `,
  updateSavingsGoal: `
    mutation UpdateSavingsGoal($id: uuid!, $_set: savings_goals_set_input!) {
      update_savings_goals_by_pk(pk_columns: { id: $id }, _set: $_set) {
        id
      }
    }
  `,
  deleteSavingsGoal: `
    mutation DeleteSavingsGoal($id: uuid!) {
      delete_savings_goals_by_pk(id: $id) {
        id
      }
    }
  `,
  savingsTransactions: `
    query SavingsTransactions($userId: uuid!, $limit: Int!, $offset: Int!) {
      savings(
        where: { user_id: { _eq: $userId } }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        amount
        currency
        base_currency
        base_amount
        fx_rate
        fx_date
        direction
        source
        date
        notes
        goal_id
        created_at
      }
    }
  `,
  insertSavingsTransaction: `
    mutation InsertSavingsTransaction($object: savings_insert_input!) {
      insert_savings_one(object: $object) {
        id
      }
    }
  `,
  deleteSavingsTransaction: `
    mutation DeleteSavingsTransaction($id: uuid!) {
      delete_savings_by_pk(id: $id) {
        id
      }
    }
  `,
  budgetsByMonth: `
    query BudgetsByMonth($userId: uuid!, $month: date!) {
      budgets(
        where: { user_id: { _eq: $userId }, month: { _eq: $month } }
      ) {
        id
        user_id
        category_id
        month
        base_currency
        limit_amount
      }
    }
  `,
  upsertBudget: `
    mutation UpsertBudget($object: budgets_insert_input!) {
      insert_budgets_one(
        object: $object
        on_conflict: {
          constraint: budgets_user_id_category_id_month_key
          update_columns: [limit_amount, base_currency]
        }
      ) {
        id
      }
    }
  `,
  notifications: `
    query Notifications($userId: uuid!, $limit: Int!, $offset: Int!) {
      notifications(
        where: { user_id: { _eq: $userId } }
        order_by: { created_at: desc }
        limit: $limit
        offset: $offset
      ) {
        id
        user_id
        kind
        severity
        title
        message
        dedupe_key
        is_read
        created_at
      }
    }
  `,
  insertNotification: `
    mutation InsertNotification($object: notifications_insert_input!) {
      insert_notifications_one(
        object: $object
        on_conflict: { constraint: notifications_user_dedupe_key, update_columns: [] }
      ) {
        id
      }
    }
  `,
  markNotificationRead: `
    mutation MarkNotificationRead($id: uuid!) {
      update_notifications_by_pk(pk_columns: { id: $id }, _set: { is_read: true }) {
        id
      }
    }
  `,
  markAllNotificationsRead: `
    mutation MarkAllNotificationsRead($userId: uuid!) {
      update_notifications(where: { user_id: { _eq: $userId } }, _set: { is_read: true }) {
        affected_rows
      }
    }
  `,
  userBalances: `
    query UserBalances($userId: uuid!) {
      user_balances_by_pk(user_id: $userId) {
        user_id
        base_currency
        cash_balance
        online_balance
        savings_balance
      }
    }
  `,
  unreadNotificationsCount: `
    query UnreadNotificationsCount($userId: uuid!) {
      notifications_aggregate(where: { user_id: { _eq: $userId }, is_read: { _eq: false } }) {
        aggregate {
          count
        }
      }
    }
  `,
  expensesByDateRange: `
    query ExpensesByDateRange($userId: uuid!, $start: date!, $end: date!) {
      expenses(
        where: { user_id: { _eq: $userId }, date: { _gte: $start, _lte: $end } }
        order_by: [{ date: asc }]
      ) {
        id
        date
        category_id
        base_amount
        base_currency
      }
    }
  `,
  incomesByDateRange: `
    query IncomesByDateRange($userId: uuid!, $start: date!, $end: date!) {
      incomes(
        where: { user_id: { _eq: $userId }, date: { _gte: $start, _lte: $end } }
        order_by: [{ date: asc }]
      ) {
        id
        date
        category_id
        base_amount
        base_currency
      }
    }
  `,
  savingsByDateRange: `
    query SavingsByDateRange($userId: uuid!, $start: date!, $end: date!) {
      savings(
        where: { user_id: { _eq: $userId }, date: { _gte: $start, _lte: $end } }
        order_by: [{ date: asc }]
      ) {
        id
        date
        direction
        base_amount
        base_currency
        goal_id
      }
    }
  `,
  searchExpenses: `
    query SearchExpenses($userId: uuid!, $q: String!, $start: date!, $end: date!) {
      expenses(
        where: {
          user_id: { _eq: $userId }
          date: { _gte: $start, _lte: $end }
          _or: [{ notes: { _ilike: $q } }]
        }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: 200
      ) {
        id
        date
        notes
        amount
        currency
        base_amount
        base_currency
        payment_method
      }
    }
  `,
  searchIncomes: `
    query SearchIncomes($userId: uuid!, $q: String!, $start: date!, $end: date!) {
      incomes(
        where: {
          user_id: { _eq: $userId }
          date: { _gte: $start, _lte: $end }
          _or: [{ notes: { _ilike: $q } }]
        }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: 200
      ) {
        id
        date
        notes
        amount
        currency
        base_amount
        base_currency
        income_type
      }
    }
  `,
  searchSavings: `
    query SearchSavings($userId: uuid!, $q: String!, $start: date!, $end: date!) {
      savings(
        where: {
          user_id: { _eq: $userId }
          date: { _gte: $start, _lte: $end }
          _or: [{ notes: { _ilike: $q } }]
        }
        order_by: [{ date: desc }, { created_at: desc }]
        limit: 200
      ) {
        id
        date
        notes
        amount
        currency
        base_amount
        base_currency
        direction
        source
        goal_id
      }
    }
  `,
} as const


