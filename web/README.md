# Dhanraksha (Web)

Personal Finance Manager frontend built with **React + TypeScript + Vite + MUI**, backed by **Nhost** (Postgres/Hasura/Auth).

## Setup

1) Install dependencies:

```bash
cd web
npm install
```

2) Create `web/.env.local` (Cursor blocks committing dotfiles here, so use this as a copy source):

```bash
cp env.example .env.local
```

3) Fill in your Nhost config in `web/.env.local`:

```bash
VITE_NHOST_SUBDOMAIN=your-project-subdomain
VITE_NHOST_REGION=eu-central-1
```

4) Run the app:

```bash
npm run dev
```

## PWA

PWA is enabled via `vite-plugin-pwa`. For production quality, add PNG icons (including a maskable icon) and update `vite.config.ts`.
