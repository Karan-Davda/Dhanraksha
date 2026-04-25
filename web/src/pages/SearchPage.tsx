import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import { nhostGraphql } from '../api/nhostGraphql'
import { Queries } from '../api/queries'
import { useNhost } from '../nhost/useNhost'
import { formatCurrency, formatDate } from '../utils/format'
import type { UserMetadata } from '../types/domain'

type SearchRow = {
  kind: 'expense' | 'income' | 'savings'
  id: string
  date: string
  notes: string | null
  amount: number
  currency: string
  base_amount: number
  base_currency: string
  meta: string
}

const kindColor: Record<SearchRow['kind'], string> = {
  expense: 'var(--color-expense)',
  income: 'var(--color-income)',
  savings: 'var(--color-savings)',
}

const kindLabel: Record<SearchRow['kind'], string> = {
  expense: 'EXPENSES',
  income: 'INCOME',
  savings: 'SAVINGS',
}

export function SearchPage() {
  const { nhost, userId } = useNhost()
  const [q, setQ] = useState('')
  const [start, setStart] = useState(() => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'))
  const [end, setEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const metadataQuery = useQuery({
    queryKey: ['user_metadata', userId],
    enabled: Boolean(nhost && userId),
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')
      const data = await nhostGraphql<{ user_metadata_by_pk: UserMetadata | null }, { userId: string }>(
        nhost,
        Queries.userMetadata,
        { userId },
      )
      return data.user_metadata_by_pk
    },
  })

  const baseCurrency = metadataQuery.data?.base_currency ?? 'USD'
  const qLike = useMemo(() => `%${q.trim()}%`, [q])
  const enabled = Boolean(nhost && userId && q.trim().length >= 2)

  const resultsQuery = useQuery({
    queryKey: ['search', userId, qLike, start, end],
    enabled,
    queryFn: async () => {
      if (!nhost || !userId) throw new Error('Not authenticated')

      const [exp, inc, sav] = await Promise.all([
        nhostGraphql<{ expenses: any[] }, { userId: string; q: string; start: string; end: string }>(nhost, Queries.searchExpenses, {
          userId,
          q: qLike,
          start,
          end,
        }),
        nhostGraphql<{ incomes: any[] }, { userId: string; q: string; start: string; end: string }>(nhost, Queries.searchIncomes, {
          userId,
          q: qLike,
          start,
          end,
        }),
        nhostGraphql<{ savings: any[] }, { userId: string; q: string; start: string; end: string }>(nhost, Queries.searchSavings, {
          userId,
          q: qLike,
          start,
          end,
        }),
      ])

      const rows: SearchRow[] = [
        ...exp.expenses.map((e) => ({
          kind: 'expense' as const,
          id: e.id,
          date: e.date,
          notes: e.notes,
          amount: Number(e.amount),
          currency: e.currency,
          base_amount: Number(e.base_amount),
          base_currency: e.base_currency,
          meta: e.payment_method,
        })),
        ...inc.incomes.map((i) => ({
          kind: 'income' as const,
          id: i.id,
          date: i.date,
          notes: i.notes,
          amount: Number(i.amount),
          currency: i.currency,
          base_amount: Number(i.base_amount),
          base_currency: i.base_currency,
          meta: i.income_type,
        })),
        ...sav.savings.map((s) => ({
          kind: 'savings' as const,
          id: s.id,
          date: s.date,
          notes: s.notes,
          amount: Number(s.amount),
          currency: s.currency,
          base_amount: Number(s.base_amount),
          base_currency: s.base_currency,
          meta: `${s.direction} • ${s.source}`,
        })),
      ]
      rows.sort((a, b) => (a.date < b.date ? 1 : -1))
      return rows
    },
  })

  const rows = resultsQuery.data ?? []

  const grouped = useMemo(() => {
    const groups: Record<SearchRow['kind'], SearchRow[]> = { expense: [], income: [], savings: [] }
    for (const r of rows) groups[r.kind].push(r)
    return groups
  }, [rows])

  const hasQuery = q.trim().length >= 2

  return (
    <div className="page-enter" style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, margin: '0 0 24px' }}>
        Search
      </h1>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ position: 'absolute', left: 20, top: 20, pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search transactions, categories, notes..."
          style={{
            width: '100%',
            height: 64,
            padding: '0 20px 0 56px',
            fontSize: '1.05rem',
            background: 'var(--color-bg-card)',
            border: '2px solid var(--color-border)',
            borderRadius: 16,
            color: 'var(--color-text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-focus)'
            e.currentTarget.style.boxShadow = 'var(--shadow-focus)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
      </div>

      {/* Date filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          From
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              color: 'var(--color-text-primary)',
              fontSize: '0.85rem',
            }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          To
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              color: 'var(--color-text-primary)',
              fontSize: '0.85rem',
            }}
          />
        </label>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
          Base currency: {baseCurrency}
        </span>
      </div>

      {/* Results */}
      {!hasQuery ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: 16, opacity: 0.4 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p style={{ margin: 0, fontSize: '1.05rem' }}>Start typing to search all your transactions</p>
        </div>
      ) : resultsQuery.isLoading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Searching…
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 600 }}>Nothing found</p>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Try adjusting your search or filters</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {(['expense', 'income', 'savings'] as const).map((kind) => {
            const items = grouped[kind]
            if (items.length === 0) return null
            return (
              <section key={kind}>
                <h3 style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: kindColor[kind],
                  margin: '0 0 12px',
                  textTransform: 'uppercase',
                }}>
                  {kindLabel[kind]} ({items.length} {items.length === 1 ? 'result' : 'results'})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((r) => (
                    <div
                      key={`${r.kind}:${r.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '14px 18px',
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 110 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          {formatDate(r.date, 'long')}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: kindColor[r.kind],
                          textTransform: 'uppercase',
                          marginTop: 2,
                        }}>
                          {r.kind}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.meta}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {r.notes || '—'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: 140, marginLeft: 'auto' }}>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: kindColor[r.kind],
                        }}>
                          {formatCurrency(r.amount, r.currency)}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8rem',
                          color: 'var(--color-text-muted)',
                          marginTop: 2,
                        }}>
                          {formatCurrency(r.base_amount, r.base_currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
