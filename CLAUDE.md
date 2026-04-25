# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dhanraksha** is a personal finance management PWA with multi-currency support, built on React + TypeScript + Nhost (Postgres/Hasura/GraphQL).

## Development Commands

All commands run from the `web/` directory:

```bash
npm run dev        # Start Vite dev server (localhost:5173)
npm run build      # TypeScript compile + Vite build → dist/
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

**Initial setup:**
```bash
cd web
npm install
cp env.example .env.local
# Fill in VITE_NHOST_SUBDOMAIN and VITE_NHOST_REGION in .env.local
npm run dev
```

## Architecture

### Layer Overview

```
pages/          → Route-level components (lazy-loaded via React.lazy)
features/       → Domain logic + UI per feature (expenses, income, budgets, savings, calendar, dashboard)
components/     → Shared layout (AppLayout) and common UI pieces
api/            → GraphQL client wrapper (nhostGraphql.ts) + all query/mutation definitions (queries.ts)
fx/             → Frankfurter API integration for real-time FX rates
nhost/          → Nhost provider setup and auth hook
types/domain.ts → Central TypeScript domain types
utils/          → Formatting, date, month helpers
```

### Backend Integration

- **Nhost** provides Auth, Postgres database, and a Hasura-managed GraphQL API.
- All data access goes through `src/api/queries.ts` (GraphQL operations) via the wrapper in `src/api/nhostGraphql.ts`.
- **React Query** (`@tanstack/react-query`) manages server state, caching, and mutations.
- Environment is validated at startup via Zod in `src/env.ts`.

### Multi-Currency Flow

- Users set a base currency in Settings (stored in `user_metadata`).
- Each transaction stores an FX snapshot at the time of entry (via Frankfurter API in `src/fx/`).
- Changing base currency triggers a balance recalculation on the backend.

### Database

Migrations live in `database/migrations/`. Key tables:
- `user_metadata` — theme, base currency, accessibility prefs per user
- `expenses`, `income` — transactions with FX snapshots
- `expense_categories`, `income_categories` — user-defined with color/icon
- `budgets` — monthly category limits
- `savings_goals`, `savings_transactions`
- `notifications` — budget alerts and reminders (with deduplication logic in `003_notifications_dedupe.sql`)
- `user_balances` — aggregated balance view updated via triggers (`004_balances_triggers.sql`)

All user-owned tables use Row-Level Security (RLS) enforcing `user_id = current_user_id()`.

### Auth

`src/auth/RequireAuth.tsx` guards all authenticated routes. The app uses Nhost's built-in email/password auth. `SetupRequiredPage` handles new users who haven't completed onboarding (setting base currency).

### Routing

`App.tsx` defines all routes. Pages are lazy-loaded. The `AppLayout` wraps all authenticated pages with the nav sidebar.

## Key Conventions

- **Feature modules** own their own dialogs and business logic — e.g. `features/expenses/AddExpenseDialog.tsx` handles form state, validation (Zod + React Hook Form), and mutation calls.
- **GraphQL operations** are centralized in `src/api/queries.ts` — add new queries/mutations there, not inline.
- **Types** are centralized in `src/types/domain.ts` — add new domain types there.
- Theme (dark/light) is driven by MUI's `ThemeProvider` via `src/theme/`.
