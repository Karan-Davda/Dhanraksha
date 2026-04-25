-- Dhanraksha (Personal Finance Manager) - Production Schema (Nhost/Postgres/Hasura)
-- Multi-currency: YES
-- Base currency: per-user (user can change; each transaction stores its own base snapshot)
--
-- How to run:
--   Nhost Console -> Database -> SQL Editor -> paste & run
--
-- Notes:
-- - auth.users is managed by Nhost.
-- - RLS is enabled on all user-owned tables (user_id = public.current_user_id()).
-- - currencies is read-only to authenticated users (no insert/update/delete policies).
-- - exchange_rates is per-user (safe to write without admin secrets).

-- 0) Extensions
create extension if not exists pgcrypto;

-- 1) Common timestamps helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1.1) Current user helper (Nhost/Hasura)
-- Nhost does NOT provide auth.uid() in Postgres (that's a Supabase pattern).
-- In Hasura, JWT claims are available via current_setting('request.jwt.claims', true)
-- and sometimes via request.jwt.claim.sub.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  with claims as (
    select nullif(current_setting('request.jwt.claims', true), '') as c
  )
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    (select (c::jsonb ->> 'sub')::uuid from claims where c is not null),
    (select (c::jsonb -> 'https://hasura.io/jwt/claims' ->> 'x-hasura-user-id')::uuid from claims where c is not null)
  );
$$;

-- 2) Currencies master (ISO)
create table if not exists public.currencies (
  code text primary key, -- USD, INR, EUR ...
  name text not null,
  symbol text,
  decimals int not null default 2 check (decimals between 0 and 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed common currencies (extend anytime)
insert into public.currencies (code, name, symbol, decimals)
values
  -- Frankfurter-supported set (30) + a couple extra
  ('USD', 'United States Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2),
  ('GBP', 'British Pound', '£', 2),
  ('AUD', 'Australian Dollar', '$', 2),
  ('BRL', 'Brazilian Real', 'R$', 2),
  ('CAD', 'Canadian Dollar', '$', 2),
  ('CHF', 'Swiss Franc', 'CHF', 2),
  ('CNY', 'Chinese Renminbi Yuan', '¥', 2),
  ('CZK', 'Czech Koruna', 'Kč', 2),
  ('DKK', 'Danish Krone', 'kr', 2),
  ('HKD', 'Hong Kong Dollar', '$', 2),
  ('HUF', 'Hungarian Forint', 'Ft', 2),
  ('IDR', 'Indonesian Rupiah', 'Rp', 2),
  ('ILS', 'Israeli New Sheqel', '₪', 2),
  ('INR', 'Indian Rupee', '₹', 2),
  ('ISK', 'Icelandic Króna', 'kr', 2),
  ('JPY', 'Japanese Yen', '¥', 0),
  ('KRW', 'South Korean Won', '₩', 2),
  ('MXN', 'Mexican Peso', '$', 2),
  ('MYR', 'Malaysian Ringgit', 'RM', 2),
  ('NOK', 'Norwegian Krone', 'kr', 2),
  ('NZD', 'New Zealand Dollar', '$', 2),
  ('PHP', 'Philippine Peso', '₱', 2),
  ('PLN', 'Polish Złoty', 'zł', 2),
  ('RON', 'Romanian Leu', 'lei', 2),
  ('SEK', 'Swedish Krona', 'kr', 2),
  ('SGD', 'Singapore Dollar', '$', 2),
  ('THB', 'Thai Baht', '฿', 2),
  ('TRY', 'Turkish Lira', '₺', 2),
  ('ZAR', 'South African Rand', 'R', 2),
  ('AED', 'United Arab Emirates Dirham', 'د.إ', 2)
on conflict (code) do nothing;

-- 3) Exchange rates (daily, relative to base_currency) - per-user cache
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  base_currency text not null references public.currencies(code) on delete restrict,
  quote_currency text not null references public.currencies(code) on delete restrict,
  rate numeric(18,8) not null check (rate > 0),
  rate_date date not null,
  provider text not null default 'frankfurter',
  created_at timestamptz not null default now(),
  unique (user_id, base_currency, quote_currency, rate_date)
);

create index if not exists idx_exchange_rates_lookup
  on public.exchange_rates(user_id, base_currency, quote_currency, rate_date desc);

-- 4) User preferences (profile)
create table if not exists public.user_metadata (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'USD' references public.currencies(code) on delete restrict,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  reduce_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_metadata_updated_at
before update on public.user_metadata
for each row execute function public.set_updated_at();

-- 5) Balances (stored in user's base currency snapshot)
-- In production you'd usually avoid storing balances as a source of truth
-- (derive from transactions), but the spec calls out balances explicitly.
create table if not exists public.user_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'USD' references public.currencies(code) on delete restrict,
  cash_balance numeric(18,2) not null default 0,
  online_balance numeric(18,2) not null default 0,
  savings_balance numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_balances_updated_at
before update on public.user_balances
for each row execute function public.set_updated_at();

-- 6) Categories
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists idx_expense_categories_user on public.expense_categories(user_id);

create trigger trg_expense_categories_updated_at
before update on public.expense_categories
for each row execute function public.set_updated_at();

create table if not exists public.income_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists idx_income_categories_user on public.income_categories(user_id);

create trigger trg_income_categories_updated_at
before update on public.income_categories
for each row execute function public.set_updated_at();

-- 7) Recurring templates
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  amount numeric(18,2) not null check (amount > 0),
  currency text not null references public.currencies(code) on delete restrict,

  base_currency text not null references public.currencies(code) on delete restrict,
  base_amount numeric(18,2) not null check (base_amount > 0),
  fx_rate numeric(18,8) not null check (fx_rate > 0),
  fx_date date not null,

  category_id uuid not null references public.expense_categories(id) on delete restrict,
  payment_method text not null check (payment_method in ('cash','online')),
  frequency text not null check (frequency in ('weekly','biweekly','monthly')),
  next_date date not null,
  notes text,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recurring_expenses_user on public.recurring_expenses(user_id);

create trigger trg_recurring_expenses_updated_at
before update on public.recurring_expenses
for each row execute function public.set_updated_at();

create table if not exists public.recurring_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  amount numeric(18,2) not null check (amount > 0),
  currency text not null references public.currencies(code) on delete restrict,

  base_currency text not null references public.currencies(code) on delete restrict,
  base_amount numeric(18,2) not null check (base_amount > 0),
  fx_rate numeric(18,8) not null check (fx_rate > 0),
  fx_date date not null,

  category_id uuid not null references public.income_categories(id) on delete restrict,
  income_type text not null check (income_type in ('cash','online')),
  frequency text not null check (frequency in ('weekly','biweekly','monthly')),
  next_date date not null,
  notes text,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recurring_incomes_user on public.recurring_incomes(user_id);

create trigger trg_recurring_incomes_updated_at
before update on public.recurring_incomes
for each row execute function public.set_updated_at();

-- 8) Transactions: expenses, incomes, savings
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  amount numeric(18,2) not null check (amount > 0),
  currency text not null references public.currencies(code) on delete restrict,

  -- Base currency snapshot for analytics/reporting
  base_currency text not null references public.currencies(code) on delete restrict,
  base_amount numeric(18,2) not null check (base_amount > 0),
  fx_rate numeric(18,8) not null check (fx_rate > 0),
  fx_date date not null,

  category_id uuid not null references public.expense_categories(id) on delete restrict,
  payment_method text not null check (payment_method in ('cash','online')),
  date date not null,
  notes text,

  is_recurring boolean not null default false,
  recurring_id uuid references public.recurring_expenses(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_user on public.expenses(user_id);
create index if not exists idx_expenses_date on public.expenses(date desc);
create index if not exists idx_expenses_category on public.expenses(category_id);
create index if not exists idx_expenses_currency on public.expenses(currency);
create index if not exists idx_expenses_base_currency on public.expenses(base_currency);

create trigger trg_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  amount numeric(18,2) not null check (amount > 0),
  currency text not null references public.currencies(code) on delete restrict,

  base_currency text not null references public.currencies(code) on delete restrict,
  base_amount numeric(18,2) not null check (base_amount > 0),
  fx_rate numeric(18,8) not null check (fx_rate > 0),
  fx_date date not null,

  category_id uuid not null references public.income_categories(id) on delete restrict,
  income_type text not null check (income_type in ('cash','online')),
  date date not null,
  notes text,

  is_recurring boolean not null default false,
  recurring_id uuid references public.recurring_incomes(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_incomes_user on public.incomes(user_id);
create index if not exists idx_incomes_date on public.incomes(date desc);
create index if not exists idx_incomes_category on public.incomes(category_id);
create index if not exists idx_incomes_currency on public.incomes(currency);
create index if not exists idx_incomes_base_currency on public.incomes(base_currency);

create trigger trg_incomes_updated_at
before update on public.incomes
for each row execute function public.set_updated_at();

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(18,2) not null check (target_amount > 0),
  currency text not null references public.currencies(code) on delete restrict,
  deadline date,
  status text not null default 'active' check (status in ('active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists idx_savings_goals_user on public.savings_goals(user_id);

create trigger trg_savings_goals_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

create table if not exists public.savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  amount numeric(18,2) not null check (amount > 0),
  currency text not null references public.currencies(code) on delete restrict,

  base_currency text not null references public.currencies(code) on delete restrict,
  base_amount numeric(18,2) not null check (base_amount > 0),
  fx_rate numeric(18,8) not null check (fx_rate > 0),
  fx_date date not null,

  direction text not null check (direction in ('deposit','withdraw')),
  source text not null check (source in ('cash','online','savings')),
  date date not null,
  notes text,
  goal_id uuid references public.savings_goals(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_savings_user on public.savings(user_id);
create index if not exists idx_savings_date on public.savings(date desc);

create trigger trg_savings_updated_at
before update on public.savings
for each row execute function public.set_updated_at();

-- 9) Budgets (category + month)
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id) on delete cascade,
  month date not null, -- store first day of month

  -- Budgets should be defined in the user's base currency for consistency
  base_currency text not null references public.currencies(code) on delete restrict,
  limit_amount numeric(18,2) not null check (limit_amount >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

create index if not exists idx_budgets_user_month on public.budgets(user_id, month);

create trigger trg_budgets_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

-- 10) Notifications (alert history)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('budget','recurring','system')),
  severity text not null default 'info' check (severity in ('info','warning','error')),
  title text not null,
  message text,
  dedupe_key text,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);

create unique index if not exists notifications_user_dedupe_key
  on public.notifications(user_id, dedupe_key)
  where dedupe_key is not null;

-- 11) RLS (Row Level Security)
alter table public.currencies enable row level security;
alter table public.exchange_rates enable row level security;

alter table public.user_metadata enable row level security;
alter table public.user_balances enable row level security;
alter table public.expense_categories enable row level security;
alter table public.income_categories enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.recurring_incomes enable row level security;
alter table public.expenses enable row level security;
alter table public.incomes enable row level security;
alter table public.savings enable row level security;
alter table public.savings_goals enable row level security;
alter table public.budgets enable row level security;
alter table public.notifications enable row level security;

-- Drop existing policies (re-runnable migration)
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'currencies','exchange_rates',
        'user_metadata','user_balances',
        'expense_categories','income_categories',
        'recurring_expenses','recurring_incomes',
        'expenses','incomes',
        'savings','savings_goals',
        'budgets','notifications'
      )
  loop
    execute format('drop policy if exists %I on public.%I;', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Read-only reference data (authenticated users can read; only admins can write)
create policy currencies_read on public.currencies
  for select
  using (public.current_user_id() is not null);

-- Exchange rates are per-user; users can manage their own cache.
create policy exchange_rates_owner on public.exchange_rates
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- Owner policies
create policy user_metadata_owner on public.user_metadata
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy user_balances_owner on public.user_balances
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy expense_categories_owner on public.expense_categories
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy income_categories_owner on public.income_categories
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy recurring_expenses_owner on public.recurring_expenses
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy recurring_incomes_owner on public.recurring_incomes
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy expenses_owner on public.expenses
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy incomes_owner on public.incomes
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy savings_owner on public.savings
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy savings_goals_owner on public.savings_goals
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy budgets_owner on public.budgets
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

create policy notifications_owner on public.notifications
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());

-- 12) Auto-create profile/balances on signup (auth.users insert)
create or replace function public.handle_new_user_defaults()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_metadata (user_id, base_currency)
  values (new.id, 'USD')
  on conflict (user_id) do nothing;

  insert into public.user_balances (user_id, base_currency, cash_balance, online_balance, savings_balance)
  values (new.id, 'USD', 0, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_auth_users_defaults') then
    create trigger trg_auth_users_defaults
    after insert on auth.users
    for each row execute function public.handle_new_user_defaults();
  end if;
end $$;

-- 13) Balances recompute + triggers (see 004_balances_triggers.sql for standalone patch)
-- Auto-maintain public.user_balances via triggers (base-currency amounts).
-- IMPORTANT: This uses stored base_amount on each row; if base currency changes historically, only
-- rows matching the current base_currency are included.

create or replace function public.recompute_user_balances(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  bc text;
  cash numeric(18,2);
  online numeric(18,2);
  savings numeric(18,2);
begin
  select base_currency into bc
  from public.user_metadata
  where user_id = p_user_id;

  if bc is null then
    bc := 'USD';
  end if;

  select
    coalesce(sum(case when income_type = 'cash' then base_amount else 0 end), 0),
    coalesce(sum(case when income_type = 'online' then base_amount else 0 end), 0)
  into cash, online
  from public.incomes
  where user_id = p_user_id
    and base_currency = bc;

  select
    cash - coalesce(sum(case when payment_method = 'cash' then base_amount else 0 end), 0),
    online - coalesce(sum(case when payment_method = 'online' then base_amount else 0 end), 0)
  into cash, online
  from public.expenses
  where user_id = p_user_id
    and base_currency = bc;

  select
    coalesce(sum(case when direction = 'deposit' then base_amount else -base_amount end), 0)
  into savings
  from public.savings
  where user_id = p_user_id
    and base_currency = bc;

  select
    cash
      - coalesce(sum(case when direction = 'deposit' and source = 'cash' then base_amount else 0 end), 0)
      + coalesce(sum(case when direction = 'withdraw' and source = 'cash' then base_amount else 0 end), 0),
    online
      - coalesce(sum(case when direction = 'deposit' and source = 'online' then base_amount else 0 end), 0)
      + coalesce(sum(case when direction = 'withdraw' and source = 'online' then base_amount else 0 end), 0)
  into cash, online
  from public.savings
  where user_id = p_user_id
    and base_currency = bc;

  insert into public.user_balances (user_id, base_currency, cash_balance, online_balance, savings_balance)
  values (p_user_id, bc, cash, online, savings)
  on conflict (user_id) do update
    set base_currency = excluded.base_currency,
        cash_balance = excluded.cash_balance,
        online_balance = excluded.online_balance,
        savings_balance = excluded.savings_balance,
        updated_at = now();
end;
$$;

create or replace function public.trg_recompute_balances()
returns trigger
language plpgsql
security definer
as $$
declare
  uid uuid;
begin
  uid := coalesce(new.user_id, old.user_id);
  perform public.recompute_user_balances(uid);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_expenses_recompute_balances on public.expenses;
create trigger trg_expenses_recompute_balances
after insert or update or delete on public.expenses
for each row execute function public.trg_recompute_balances();

drop trigger if exists trg_incomes_recompute_balances on public.incomes;
create trigger trg_incomes_recompute_balances
after insert or update or delete on public.incomes
for each row execute function public.trg_recompute_balances();

drop trigger if exists trg_savings_recompute_balances on public.savings;
create trigger trg_savings_recompute_balances
after insert or update or delete on public.savings
for each row execute function public.trg_recompute_balances();

drop trigger if exists trg_user_metadata_recompute_balances on public.user_metadata;
create trigger trg_user_metadata_recompute_balances
after update of base_currency on public.user_metadata
for each row execute function public.trg_recompute_balances();


