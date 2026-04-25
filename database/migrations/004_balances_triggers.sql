-- Auto-maintain public.user_balances via triggers (base-currency amounts).
-- IMPORTANT: This uses stored base_amount on each row. If you change a user's base_currency,
-- existing transactions may have base_amount in an older base currency.
-- We recompute balances only using rows whose base_currency matches current user_metadata.base_currency.

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

  -- incomes add to cash/online
  select
    coalesce(sum(case when income_type = 'cash' then base_amount else 0 end), 0),
    coalesce(sum(case when income_type = 'online' then base_amount else 0 end), 0)
  into cash, online
  from public.incomes
  where user_id = p_user_id
    and base_currency = bc;

  -- expenses subtract from cash/online
  select
    cash - coalesce(sum(case when payment_method = 'cash' then base_amount else 0 end), 0),
    online - coalesce(sum(case when payment_method = 'online' then base_amount else 0 end), 0)
  into cash, online
  from public.expenses
  where user_id = p_user_id
    and base_currency = bc;

  -- savings movements:
  -- deposit: source account decreases; savings increases
  -- withdraw: savings decreases; destination account (source) increases
  select
    coalesce(sum(case when direction = 'deposit' then base_amount else -base_amount end), 0)
  into savings
  from public.savings
  where user_id = p_user_id
    and base_currency = bc;

  -- apply source impacts
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

-- Recompute on transaction changes
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

-- If base currency changes, recompute balances immediately.
drop trigger if exists trg_user_metadata_recompute_balances on public.user_metadata;
create trigger trg_user_metadata_recompute_balances
after update of base_currency on public.user_metadata
for each row execute function public.trg_recompute_balances();





