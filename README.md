# FinanceAI — AI-Powered Wealth Management & Advisory Platform

> **FinanceAI** is a production-grade personal wealth and investment platform. Built with **Next.js 14**, **Prisma**, **PostgreSQL**, and **TypeScript**, it features multi-asset portfolio tracking, double-entry transfers, automated portfolio rebalancing, loan amortization, deterministic financial analytics, and privacy-first AI advisory powered by **NVIDIA NIM** and **Google Gemini**.

![Next.js](https://img.shields.io/badge/Next.js-14.2.25-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)
![Vitest](https://img.shields.io/badge/Vitest-2.1-729B1B?style=flat-square&logo=vitest)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Table of Contents

1. [Architectural Highlights](#1-architectural-highlights)
2. [Feature & Status Matrix](#2-feature--status-matrix)
3. [Technology Stack](#3-technology-stack)
4. [Getting Started & Local Setup](#4-getting-started--local-setup)
5. [Environment Variables](#5-environment-variables)
6. [Database Migrations & Seeding](#6-database-migrations--seeding)
7. [Automated Testing & Quality Gates](#7-automated-testing--quality-gates)
8. [Market Data & Price Freshness Policy](#8-market-data--price-freshness-policy)
9. [Privacy, Data Export & Account Deletion](#9-privacy-data-export--account-deletion)
10. [Production Deployment & Health Probes](#10-production-deployment--health-probes)

---

## 1. Architectural Highlights

- **Strict Decimal Precision:** All monetary amounts, asset prices, and cash flow values use `@db.Decimal(19, 4)` and `Decimal(18, 6)` for fractional quantities, eliminating binary floating-point rounding errors.
- **Double-Entry Ledger:** Transfers between accounts generate balanced debit and credit legs paired via `transferGroupId`, synchronized atomically in database transactions with self-transfer guards.
- **Pure Deterministic Analytics:** Portfolio allocation drift, XIRR/CAGR returns, 5-pillar financial health scoring, and portfolio rebalancing (`CASH_ONLY` vs `ALLOW_SELLS`) are calculated deterministically before AI advisory.
- **Dual AI Providers with Safe Fallback:** Powered primarily by NVIDIA NIM (`nemotron-3-nano-omni-30b-a3b-reasoning`) with secondary fallback to Google Gemini (`gemini-2.5-flash`). Zero hallucination guarantee: if AI providers are unreachable or rate-limited, the deterministic rule engine delivers fully calculated advice with transparent disclosure banners.
- **Idempotent Portfolio Imports:** Broker-specific adapters for Groww (Stocks & Mutual Funds) and INDmoney (US Stocks & Mutual Funds) use deterministic composite keys (`importKey`) to ensure re-importing statements never duplicates holdings or quantities.
- **Enterprise Security:** User isolation enforced at every database query, PII redaction on AI prompts, secret scrubbing in structured JSON logs, sliding-window rate limiting, and private no-cache headers on financial endpoints.

---

## 2. Feature & Status Matrix

| Domain | Capability | Implementation Status | Evidence / Location |
| :--- | :--- | :---: | :--- |
| **Auth** | Clerk Authentication & Demo Fallback | **VERIFIED** | `src/lib/auth.ts`, `middleware.ts` |
| **Dashboard** | Net Worth, Health Score, Cash Flow, Budgets | **VERIFIED** | `app/(dashboard)/dashboard/page.tsx` |
| **Portfolio** | Multi-Asset Holdings, P&L, Allocation, Targets | **VERIFIED** | `app/(dashboard)/portfolio/page.tsx`, `AssetService` |
| **Rebalancing** | Deterministic Rebalance Engine (Cash/Sells) | **VERIFIED** | `src/lib/finance/rebalance.ts`, `tests/rebalance.test.ts` |
| **Ledger** | Double-Entry Transfers & Atomic Leg Sync | **VERIFIED** | `TransactionService`, `tests/transfer-semantics.test.ts` |
| **Accounts** | Account CRUD, Type Badges & Safe Soft-Close | **VERIFIED** | `AccountService`, `tests/account.service.test.ts` |
| **Liabilities** | Amortization Schedule & Prepayment Simulator | **VERIFIED** | `LiabilityService`, `tests/liability.service.test.ts` |
| **Calculators** | SIP, SWP, Lumpsum, EMI, CAGR, XIRR | **VERIFIED** | `app/(dashboard)/calculators/page.tsx`, `tests/calculators.test.ts` |
| **Imports** | Groww & INDmoney CSV/XLSX Deduplicated Import | **VERIFIED** | `src/adapters/`, `tests/adapters.test.ts`, `tests/import-flow.test.ts` |
| **AI Advisor** | NVIDIA NIM + Gemini with Context Redaction | **VERIFIED** | `src/services/ai/`, `tests/ai.test.ts` |
| **Pricing** | Yahoo Finance (Stocks) + MFAPI (Mutual Funds) | **VERIFIED** | `PriceEngineService`, `tests/prices-refresh.test.ts` |
| **Cron** | Scheduled EOD Price & FX Refresh (`/api/cron/prices`) | **VERIFIED** | `app/api/cron/prices/route.ts` |
| **Export** | GDPR/DPDP JSON Archive & CSV Downloads | **VERIFIED** | `DataExportService`, `app/api/export/route.ts` |
| **Deletion** | Atomic Account & Records Purge (`/api/account`) | **VERIFIED** | `AccountLifecycleService`, `app/api/account/route.ts` |
| **Health** | System Health Probe (`/api/health`) | **VERIFIED** | `app/api/health/route.ts`, `tests/ops-readiness.test.ts` |

---

## 3. Technology Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router, React Server Components, Server Actions)
- **Language:** TypeScript 5.5 (strict type-checking enabled)
- **Database & ORM:** PostgreSQL with [Prisma 5.22](https://www.prisma.io/)
- **Authentication:** [Clerk](https://clerk.com/) (`@clerk/nextjs` ^6.11)
- **Styling:** [Tailwind CSS 3.4](https://tailwindcss.com/) with dark mode glassmorphism
- **Data Visualization:** [Recharts 2.12](https://recharts.org/)
- **Cache & Rate Limiting:** In-memory Map (local) / [Upstash Redis REST](https://upstash.com/) (production)
- **AI Inference:** NVIDIA NIM (OpenAI-compatible) and Google Generative AI SDK
- **Testing:** [Vitest 2.1](https://vitest.dev/) with automated mock delegates

---

## 4. Getting Started & Local Setup

### Prerequisites

- **Node.js:** v18.17.0 or higher (v20+ recommended)
- **Package Manager:** `npm` (v9+)
- **Database:** PostgreSQL (v14+) running locally or accessible via URL

### Installation

1. **Clone repository and install dependencies:**
   ```bash
   git clone <repo-url> financeai
   cd financeai
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   *Edit `.env.local` to point `DATABASE_URL` to your local or hosted PostgreSQL instance.*

3. **Initialize database schema & migrations:**
   ```bash
   npx prisma migrate deploy
   ```
   *Or for rapid local development:*
   ```bash
   npm run db:push
   ```

4. **Seed initial demonstration records:**
   ```bash
   npm run db:seed
   ```
   *Populates demo user portfolios, transactions, accounts, budgets, and historical snapshots.*

5. **Start local development server:**
   ```bash
   npm run dev
   ```
   *Open [http://localhost:3000](http://localhost:3000) in your browser.*

---

## 5. Environment Variables

All supported environment configuration keys are documented in [`.env.example`](.env.example):

| Variable | Requirement | Description |
| :--- | :---: | :--- |
| `DATABASE_URL` | **Required** | PostgreSQL connection string (supports PgBouncer/Supabase). |
| `NEXT_PUBLIC_APP_URL` | **Required (Prod)** | Canonical domain URL for CORS and OAuth redirects. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional (Dev) | Clerk public key for client-side authentication. |
| `CLERK_SECRET_KEY` | Optional (Dev) | Clerk backend secret key. |
| `NVIDIA_NIM_API_KEY` | Optional | API token for live NVIDIA NIM LLM inference. |
| `NVIDIA_NIM_BASE_URL` | Optional | NVIDIA NIM endpoint (`https://integrate.api.nvidia.com/v1`). |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for secondary fallback advisory. |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST URL for distributed cache and rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis REST Bearer token. |
| `CRON_SECRET` | **Required (Prod)** | Shared secret token securing `/api/cron/prices`. |

---

## 6. Database Migrations & Seeding

FinanceAI maintains versioned Prisma migrations in `prisma/migrations/`:

```bash
# Apply pending versioned migrations in production
npm run db:migrate

# Push schema directly in local scratch development
npm run db:push

# Reset database and seed fresh demonstration records
npm run db:reset
```

---

## 7. Automated Testing & Quality Gates

The repository enforces 4 automated verification gates prior to deployment:

```bash
# 1. Execute Vitest test suite (467 tests across 34 suites)
npm test

# 2. Verify strict TypeScript type compliance (0 errors)
npm run typecheck

# 3. Verify ESLint formatting & style rules (0 warnings)
npm run lint

# 4. Compile optimized Next.js production bundle
npm run build
```

---

## 8. Market Data & Price Freshness Policy

- **Stock Quotes:** Sourced from Yahoo Finance EOD quotes for NSE/BSE and US equities. Succeeded lookups are cached with a 5-minute TTL (`STOCK_PRICE_TTL_SECONDS=300`).
- **Mutual Fund NAVs:** Sourced from the AMFI public feed via [MFAPI](https://api.mfapi.in). Succeeded lookups are cached for 6 hours (`MF_NAV_TTL_SECONDS=21600`).
- **Exchange Rates:** USD/INR exchange rates are fetched from the European Central Bank feed via [Frankfurter](https://api.frankfurter.dev/v1).
- **Price Failure Safety:** Failed quote lookups (timeouts, 429 rate limits, ticker not found) **never** overwrite last-known-good valuations. Holdings with unavailable quotes retain cost basis and flag a `priceSource: "COST_BASIS"` notice.
- **Transparency Notice:** Market prices represent end-of-day or delayed valuations and are not real-time tick quotes.

---

## 9. Privacy, Data Export & Account Deletion

FinanceAI is architected around financial data sovereignty:
- **Privacy Mode:** Click the eye/lock icon in the sidebar or mobile header to instantly mask all account balances, net worth values, and transactions across the UI.
- **Data Minimization:** AI context prompts scrub PAN numbers, Aadhaar, phone numbers, email addresses, and account numbers prior to transmission.
- **GDPR / DPDP Data Export:** Users can download an authenticated full JSON archive or standard RFC 4180 CSV tables at `GET /api/export` (`?format=csv`).
- **Right to Erasure (Hard Purge):** `DELETE /api/account` executes an atomic cascade deletion across all 9 database tables and purges the Clerk user record upon explicit confirmation (`confirmation: "DELETE"`).

---

## 10. Production Deployment & Health Probes

### Deployment Checklist

1. Configure production environment variables (`DATABASE_URL`, `CLERK_SECRET_KEY`, `CRON_SECRET`, etc.).
2. Run database migrations: `npm run db:migrate`.
3. Verify system health probe: `curl -f https://<your-domain>/api/health`.

### System Health Probe (`GET /api/health`)

Uptime monitoring services (AWS Route53, Pingdom, Better Uptime) can poll `/api/health` without authentication. It verifies PostgreSQL database connectivity, cache availability, and AI provider status:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": { "status": "up", "latencyMs": 4 },
    "cache": { "status": "up", "mode": "upstash_redis", "latencyMs": 2 },
    "ai": { "status": "up" }
  }
}
```
