-- Add dedupe key + data payload for notifications (production-friendly).
-- This prevents duplicate budget threshold alerts.

alter table public.notifications
  add column if not exists dedupe_key text,
  add column if not exists data jsonb;

create unique index if not exists notifications_user_dedupe_key
  on public.notifications(user_id, dedupe_key)
  where dedupe_key is not null;


