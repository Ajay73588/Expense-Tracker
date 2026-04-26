# FinanceAI — AI-Powered Personal Finance & Investment Advisory

> A production-grade full-stack fintech web application. Track your multi-asset portfolio, manage budgets, chase financial goals, and get AI-driven insights — all in one dark, modern interface.

![Stack](https://img.shields.io/badge/stack-Next.js_14_·_Prisma_·_SQLite_·_Recharts-2b73ff?style=flat-square)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Features — Fully Implemented](#2-features--fully-implemented)
3. [Features — Partially Implemented (Mocked / Simplified)](#3-features--partially-implemented-mocked--simplified)
4. [Features — NOT Implemented (Manual Work Required)](#4-features--not-implemented-manual-work-required)
5. [How to Run](#5-how-to-run)
6. [Project Structure](#6-project-structure)
7. [How to Extend](#7-how-to-extend)
8. [Environment Variables](#8-environment-variables)

---

## 1. Project Overview

FinanceAI is a unified personal finance platform built to the architecture specification. It covers:

- **Multi-asset portfolio tracking**: stocks, mutual funds, crypto, real estate, cash with real-time P&L
- **Transaction management**: income/expense logging with category breakdown and monthly summaries
- **Budget manager**: per-category monthly limits with WARN/EXCEEDED status
- **Financial goals**: progress tracking with monthly required contributions
- **Net worth engine**: asset minus liabilities with 90-day historical snapshots
- **Financial health score**: 5-dimension weighted 0–10 score (savings rate, DTI, investment allocation, goal progress, diversification)
- **Rule-based + AI insights**: alerts for budget breaches, portfolio drift, and goal lag
- **AI Advisory chat**: 6 structured AI actions + free-form chat, backed by Minimax API with rule-based fallback
- **CSV importer**: Groww, Zerodha, INDmoney, and generic format detection with preview

The demo runs fully offline with no external API keys required.

---

## 2. Features — Fully Implemented

### Backend
| Feature | Status | Notes |
|---|---|---|
| Prisma schema (all 8 entities) | ✅ | User, Asset, Transaction, Liability, Goal, Budget, Snapshot, AllocationTarget, AIConversation |
| All 10 API routes | ✅ | /dashboard, /transactions, /assets, /portfolio, /budget, /goals, /net-worth, /health-score, /insights, /import, /ai |
| TransactionService | ✅ | CRUD, monthly summary, category split, current month totals |
| AssetService | ✅ | CRUD, bulk upsert, P&L injection, soft delete |
| PortfolioService | ✅ | Allocation, risk score (0–10), portfolio summary, rebalance plan |
| BudgetService | ✅ | Upsert, per-category usage, OK/WARN/EXCEEDED status |
| GoalService | ✅ | CRUD, progress %, monthly required, on-track flag |
| NetWorthService | ✅ | Current total, asset-liability breakdown, 90-day history |
| HealthScoreService | ✅ | All 5 dimensions per architecture spec |
| InsightsService | ✅ | Rule-based: budget breaches, portfolio drift, goal lag, health score nudges |
| AIAdvisoryService | ✅ | 6 action types, rule-based fallback for all, Minimax integration if API key present |
| PromptBuilder | ✅ | Structured financial context injection per action |
| ImportService | ✅ | CSV parse, adapter detection, preview mode, bulk upsert |
| CSV Adapters | ✅ | Groww, Zerodha, INDmoney, Generic fallback |
| In-memory cache | ✅ | TTL-based, replaces Redis for dev; same interface |
| Structured logger | ✅ | JSON log lines matching architecture spec |
| Zod validation | ✅ | All POST/PATCH inputs validated |
| Error normalisation | ✅ | AppError hierarchy, consistent API error shape |
| Demo auth | ✅ | Single seeded user, no Clerk required for dev |
| Seed script | ✅ | 16 assets, 2 liabilities, ~70 transactions, 5 goals, 6 budgets, 90 snapshots |

### Frontend
| Page | Status |
|---|---|
| Sidebar navigation | ✅ |
| Dashboard | ✅ Net worth chart, health radial, income/expense bars, allocation pie, insights feed, budget bars, goal bars |
| Portfolio | ✅ Holdings table with P&L, allocation pie, rebalance plan, top gainers/losers |
| Transactions | ✅ Add/delete, type filter, monthly bar chart, category bar chart, full table |
| Budget | ✅ Add/delete budgets, progress bars, status pills, summary table |
| Goals | ✅ Add/edit/delete, progress rings, on-track badge, deadline countdown |
| AI Advisor | ✅ Chat UI, 6 quick actions, streaming-style UX, markdown rendering |
| Import | ✅ Drag & drop, broker detection, preview table, import report |

---

## 3. Features — Partially Implemented (Mocked / Simplified)

| Feature | Current State | Production Gap |
|---|---|---|
| **Price Engine** | Returns deterministic pseudo-prices from a day-seeded hash + base lookup table | Needs real NSE/BSE stock feed, mfapi.in for MF NAVs, CoinGecko for crypto |
| **AI Model** | Rule-based fallback covers all 7 actions; real Minimax call fires if `MINIMAX_API_KEY` is set | SSE streaming, JSON-mode structured responses, retry + circuit breaker |
| **Cache layer** | In-process Map with TTL, resets on server restart | Replace with `ioredis` pointed at `REDIS_URL`; same interface, just swap `src/lib/cache.ts` |
| **Auth** | `getCurrentUser()` always returns the seeded demo user | Replace with `@clerk/nextjs` `auth()` + middleware; same call-site interface |
| **SQLite vs PostgreSQL** | `prisma/schema.prisma` uses `sqlite` provider; no enums or array columns | Change provider to `postgresql`, add real `enum` types, use `String[]` for tags |
| **Snapshot cron** | `NetWorthService.takeSnapshot()` exists but isn't scheduled | Add `vercel-cron` or a standalone worker calling `/api/cron/snapshot` daily |
| **Mobile sidebar** | Desktop sidebar only (hidden on small screens) | Add hamburger + drawer for `< lg` breakpoints |

---

## 4. Features — NOT Implemented (Manual Work Required)

| Feature | What's Needed |
|---|---|
| **Real AI streaming (SSE)** | Replace `MinimaxClient.complete()` with a streaming fetch; use `ReadableStream` in the API route and `EventSource` in the AI chat page |
| **Clerk authentication** | `npm install @clerk/nextjs` → wrap `app/layout.tsx` in `<ClerkProvider>` → add middleware → replace `src/lib/auth.ts` with `auth()` from Clerk |
| **Redis caching** | `npm install ioredis` → update `src/lib/cache.ts` to use `ioredis` client → set `REDIS_URL` |
| **Real price APIs** | Add provider adapters in `src/services/price-engine.service.ts`: `yahoo-finance2` for NSE stocks, `mfapi.in` free API for MF NAVs, CoinGecko `/simple/price` for crypto |
| **Background jobs (cron)** | Snapshot engine, price refresher, AI monthly summary, alert dispatcher — wire via Vercel Cron or a BullMQ worker |
| **Email alerts** | `AlertService` stub exists; needs Resend/SendGrid integration for budget exceeded + goal milestone emails |
| **Scenario simulator** | Client-side compound interest projector with SIP growth chart (described in §12.1) |
| **Multi-user / Clerk roles** | Each API route uses `getCurrentUserId()` — adding Clerk makes it automatically multi-tenant |
| **Production DB (PostgreSQL)** | Switch `schema.prisma` provider, re-enable native enums and array columns, run `prisma migrate deploy` |
| **Privacy mode toggle** | `User.privacyMode` column exists; wire a settings page toggle + read `privacyMode` in `formatINR()` |
| **Settings page** | Currency, allocation targets editor, privacy mode, profile name |
| **Observability** | Replace console logger with Datadog / CloudWatch transport; add request timing middleware |

---

## 5. How to Run

### Prerequisites
- Node.js 18+
- npm 9+

### Steps

```bash
# 1. Clone / unzip
cd financeai

# 2. Install dependencies
npm install

# 3. Create .env
cp .env.example .env
# Default DATABASE_URL="file:./dev.db" works as-is.

# 4. Create DB schema + seed demo data  (one command)
npm run setup

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the dashboard with fully seeded data.

### Optional: AI with Minimax

```bash
# In .env:
MINIMAX_API_KEY=your_key_here
MINIMAX_API_URL=https://api.minimax.chat/v1/text/chatcompletion_v2
```

Without this, the AI Advisor uses the rule-based fallback for all responses.

### Reset demo data

```bash
npm run db:reset   # drops + re-seeds
```

---

## 6. Project Structure

```
financeai/
├── app/
│   ├── (dashboard)/          # All protected pages (no auth in demo mode)
│   │   ├── dashboard/        # Main overview
│   │   ├── portfolio/        # Asset holdings + P&L
│   │   ├── transactions/     # Income / expense log
│   │   ├── budget/           # Budget limits & usage
│   │   ├── goals/            # Financial goals tracker
│   │   ├── ai/               # AI advisory chat
│   │   └── import/           # CSV import wizard
│   ├── api/                  # API routes (thin handlers → services)
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── assets/
│   │   ├── portfolio/
│   │   ├── budget/
│   │   ├── goals/
│   │   ├── net-worth/
│   │   ├── health-score/
│   │   ├── insights/
│   │   ├── import/
│   │   ├── ai/
│   │   └── seed/
│   ├── globals.css
│   └── layout.tsx
├── src/
│   ├── services/             # All business logic
│   │   ├── transaction.service.ts
│   │   ├── asset.service.ts
│   │   ├── portfolio.service.ts
│   │   ├── budget.service.ts
│   │   ├── goal.service.ts
│   │   ├── networth.service.ts
│   │   ├── healthscore.service.ts
│   │   ├── insights.service.ts
│   │   ├── import.service.ts
│   │   ├── price-engine.service.ts
│   │   └── ai/
│   │       ├── ai-advisory.service.ts
│   │       ├── prompt-builder.service.ts
│   │       └── minimax-client.ts
│   ├── lib/
│   │   ├── prisma.ts          # Prisma singleton
│   │   ├── auth.ts            # Demo auth (replace with Clerk)
│   │   ├── cache.ts           # In-memory cache (replace with Redis)
│   │   ├── logger.ts          # Structured JSON logger
│   │   ├── api.ts             # ok() / fail() helpers
│   │   ├── errors/            # AppError hierarchy
│   │   └── validators/        # Zod schemas
│   ├── adapters/              # CSV import parsers
│   │   ├── base.adapter.ts
│   │   ├── groww.adapter.ts
│   │   ├── zerodha.adapter.ts
│   │   └── indmoney.adapter.ts
│   ├── types/index.ts         # Shared TypeScript types + enums
│   └── utils/
│       ├── format.ts          # formatINR, formatPercent, etc.
│       └── cn.ts              # Tailwind className merge
├── components/
│   ├── charts/Charts.tsx      # Recharts wrappers (5 chart types)
│   ├── cards/Card.tsx         # Card, StatCard, CardHeader
│   └── ui/Sidebar.tsx         # Navigation sidebar
├── prisma/
│   ├── schema.prisma          # Full DB schema (SQLite)
│   └── seed.ts                # Realistic Indian finance demo data
├── .env.example
├── next.config.js
├── tailwind.config.js
└── README.md
```

---

## 7. How to Extend

### Add a real price provider
Edit `src/services/price-engine.service.ts`. Add a new `async function fetchStock(symbol)` that calls a real API (e.g. `yahoo-finance2`), and change the switch inside `PriceEngineService.fetch()` to call it.

### Swap Redis in
Replace `src/lib/cache.ts` implementation with `ioredis`. The `get/set/del/delByPrefix` interface is identical — services don't need to change.

### Add Clerk auth
1. `npm install @clerk/nextjs`
2. Wrap `app/layout.tsx` in `<ClerkProvider>`
3. Add `middleware.ts` at the project root
4. Replace `src/lib/auth.ts` body with `const { userId } = auth(); if (!userId) throw new UnauthorizedError();`

### Add a new AI action
1. Add to `AIAction` constant in `src/types/index.ts`
2. Add an instruction string to `ACTION_INSTRUCTIONS` in `prompt-builder.service.ts`
3. Add a `fallbackFor` case in `ai-advisory.service.ts`
4. Add a button to `app/(dashboard)/ai/page.tsx`

### Add a new CSV broker
1. Create `src/adapters/youbroker.adapter.ts` implementing `BrokerAdapter`
2. Register it in `ADAPTERS` array in `src/services/import.service.ts`

---

## 8. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `file:./dev.db` | Prisma database URL. Use `postgresql://` for production |
| `MINIMAX_API_KEY` | No | — | Minimax API key. Without it, rule-based AI fallback is used |
| `MINIMAX_API_URL` | No | Minimax default | Override API endpoint |
| `REDIS_URL` | No | — | Redis connection string. Without it, in-memory cache is used |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Database | SQLite (dev) / PostgreSQL (production) |
| ORM | Prisma 5 |
| Styling | Tailwind CSS 3 |
| Charts | Recharts 2 |
| Validation | Zod |
| AI | Minimax API + rule-based fallback |
| Cache | In-memory Map (dev) / Redis (production) |
| Auth | Demo stub (dev) / Clerk (production) |

---

*Built as a complete reference implementation of the AI-Powered Personal Finance & Investment Advisory System architecture.*
