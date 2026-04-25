-- Fix current_user_id() to work with Nhost/Hasura v2.
--
-- Nhost's Hasura v2 passes the authenticated user ID via multiple possible
-- locations. The original function only checked request.jwt.claims, which
-- may be empty in some Nhost configurations. This version adds fallbacks.
--
-- Run in: Nhost Console → Database → SQL Editor

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    -- 1. Hasura v2: session variables (most reliable for Nhost)
    nullif(current_setting('request.session_variables', true), '')::jsonb
      ->> 'x-hasura-user-id',

    -- 2. Hasura v2: full JWT payload → Hasura namespace
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'https://hasura.io/jwt/claims')
      ->> 'x-hasura-user-id',

    -- 3. Fallback: JWT sub claim
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      ->> 'sub'
  )::uuid
$$;
