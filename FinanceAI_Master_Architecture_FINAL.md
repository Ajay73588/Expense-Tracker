# FinanceAI — Master Architecture (FINAL, single source of truth)

**Document ID:** `FinanceAI_Master_Architecture_FINAL.md`
**Consolidated:** 2026-10-10
**Stack (per source docs):** Next.js 14.2.25 · React 18 · TypeScript 5.5 · Prisma 5.22 / PostgreSQL (default) · Firestore (legacy, `USE_FIREBASE=true`) · Clerk · Tailwind · Recharts · Vitest 2.1 · Yahoo Finance / MFAPI / Frankfurter · **NVIDIA NIM (Active Primary AI Provider for Advisor & Import) + Google Gemini (Secondary/Legacy; MiniMax retired)**

## Table of contents

- [1. Document purpose and source of truth](#1-document-purpose-and-source-of-truth)
- [2. Executive summary, vision, goals and non-goals](#2-executive-summary-vision-goals-and-non-goals)
- [3. Current-state audit and evidence matrix](#3-current-state-audit-and-evidence-matrix)
- [4. Core user journeys and functional feature catalogue](#4-core-user-journeys-and-functional-feature-catalogue)
- [5. Navigation and page/route inventory](#5-navigation-and-pageroute-inventory)
- [6. Technology stack and system architecture](#6-technology-stack-and-system-architecture)
- [7. Frontend conventions and component architecture](#7-frontend-conventions-and-component-architecture)
- [8. Backend APIs and service boundaries](#8-backend-apis-and-service-boundaries)
- [9. Database and domain model](#9-database-and-domain-model)
- [10. Portfolio valuation and financial calculation rules](#10-portfolio-valuation-and-financial-calculation-rules)
- [11. Imports, idempotency, duplicate detection and reconciliation](#11-imports-idempotency-duplicate-detection-and-reconciliation)
- [12. Market pricing, NAV, FX, cache and freshness](#12-market-pricing-nav-fx-cache-and-freshness)
- [13. AI advisor: Gemini and Grok providers, existing prompts, privacy, fallbacks, rebalancing](#13-ai-advisor-gemini-and-grok-providers-existing-prompts-privacy-fallbacks-rebalancing)
- [14. Security, authorization, privacy and secrets](#14-security-authorization-privacy-and-secrets)
- [15. Error handling, observability, performance and background work](#15-error-handling-observability-performance-and-background-work)
- [16. Testing strategy and feature acceptance criteria](#16-testing-strategy-and-feature-acceptance-criteria)
- [17. Environment-variable reference (placeholders only)](#17-environment-variable-reference-placeholders-only)
- [18. Phased implementation roadmap](#18-phased-implementation-roadmap)
- [19. Known limitations, unresolved decisions and risks](#19-known-limitations-unresolved-decisions-and-risks)
- [20. Definition of done and release checklist](#20-definition-of-done-and-release-checklist)
- [21. Source reconciliation and change log](#21-source-reconciliation-and-change-log)

---

## 1. Document purpose and source of truth

### 1.1 Purpose
This is the one canonical specification for FinanceAI: product scope, current state, target behavior, data model, calculation rules, import/AI/pricing design, security, tests, and a single phased roadmap. A coding agent should be able to work from this file alone.

### 1.2 Source-of-truth policy
1. **This document overrides every older architecture document.** `FinanceAI_Architecture.md` (v2.0), v2.1, v2.2, v2.3, `audit.md`, `IMPLEMENTATION_PHASES.md`, `ARCHITECTURE_DECISIONS.md`, `DATA_001_MIGRATION_PLAN.md`, `CODEBASE_AUDIT.md` and `IMPLEMENTATION_PROGRESS.md` are **historical references**. They may not independently override anything here.
2. Requirements come from this file. **Implementation status comes from the live repository** (code + passing tests), recorded in `docs/IMPLEMENTATION_PROGRESS.md`. If the repo and this file disagree on *status*, the repo wins and this file is corrected; if they disagree on *target behavior*, this file wins.
3. Proposals are labelled **(Proposal)**. Nothing labelled Proposal may be described as implemented.

### 1.3 Status legend

| Status | Meaning |
|---|---|
| **Verified implemented** | Source code exists **and** a source document cites passing tests for it. *Caveat:* this consolidation did not itself inspect the repository (no ZIP/source was supplied). The label means "reported tested in `IMPLEMENTATION_PROGRESS.md`"; task **P0-R02** re-runs the suite to confirm. |
| **Implemented but unverified** | Code reportedly exists; no adequate tests or no live-environment confirmation. |
| **Partial** | Only part of the workflow exists. |
| **Planned** | Target behavior, not implemented. |
| **Blocked / open decision** | Needs a decision, credential, provider fact, sample file, or evidence. |

### 1.4 Evidence basis of this consolidation
Inputs used: the 11 supplied documents. **No repository ZIP or source files were provided**, so no file path, schema field or test below was inspected by this consolidation; each is taken from the progress/audit documents and is only as reliable as they are. Provider facts for Gemini/Grok were **not** researched (no web research performed); see §13.2.

---

## 2. Executive summary, vision, goals and non-goals

### 2.1 Vision
FinanceAI is a privacy-first personal wealth tracker and planner for retail investors (initially India-focused, INR base, USD holdings supported). It aggregates assets, liabilities, cash flow, goals and portfolio analytics from **manual entry and user-supplied statement files** — never bank credentials — and offers an AI explanation layer on top of **deterministic** calculations.

### 2.2 Users
Indian retail investors (stocks, mutual funds, EPF/PPF/NPS, FDs, gold); globally-exposed professionals (US stocks via INDmoney, USD/INR); privacy-conscious users avoiding credential-sharing aggregators.

### 2.3 Design principles
1. **Deterministic core, advisory AI.** All amounts, valuations, allocations, drift and trade sizes are computed by tested TypeScript; LLMs only explain.
2. **Never fabricate.** A failed price/FX/AI call never produces a zero, invented rate, or fake success.
3. **Last-known-good with provenance.** Stored valuations carry source and timestamp; failures leave them untouched.
4. **Server-side ownership.** Every query is scoped by authenticated `userId`; other users' records return 404.
5. **Ephemeral files.** Uploaded statements are parsed in memory; raw bytes and passwords are never persisted or logged.
6. **Idempotent ingestion.** Re-importing the same data changes nothing.
7. **Preserve working behavior.** Verified adapters and flows are frozen by regression tests before change.

### 2.4 Non-goals
Trade execution; bank credential scraping / screen-scraping; payment initiation; registered investment advice (SEBI/SEC); tick-level streaming; claiming guaranteed returns or provider availability.

---

## 3. Current-state audit and evidence matrix

Baseline reported in `IMPLEMENTATION_PROGRESS.md` (2026-10-10 16:24 IST): `npm test` 136 passed / 5 skipped (8 files); `npm run typecheck` exit 0; `npm run lint` exit 0 (earlier run); `npm run build` exit 0 (14:39 IST, **before** the Decimal/Account changes — must be re-run). Repo is **not a git repository** (ZIP extract): no history, no rollback by VCS.

| Capability | Status | Evidence (as reported) | Gap / next action |
|---|---|---|---|
| Clerk auth + Prisma user upsert | Implemented but unverified | `src/lib/auth.ts`; userId in service `where` clauses | No unauthenticated-access regression test; needs live Clerk |
| Prisma/PostgreSQL mode | Implemented but unverified | `src/lib/prisma.ts`, `feature-gate.ts` | Uses `db push`, no versioned migrations (risk §19) |
| Firestore legacy mode | Implemented but unverified | `src/lib/firebase.ts` | Not target path; price refresh returns 501 in this mode (ADR-002) |
| Groww stock / Groww MF / INDmoney US stock / INDmoney MF import | Verified implemented (reported) | `src/adapters/*`; `tests/adapters.test.ts`, `tests/import-flow.test.ts` | Anonymized fixtures only; real-sample tests skipped (5) |
| INDmoney Indian stocks | Planned (explicitly unsupported) | registry rejects with guidance | Needs real sample file |
| Import preview/commit, re-import no-op, replaceMissing soft-delete | Verified implemented (reported) | `tests/import-flow.test.ts` groups H–M | Confirm account-scoped key behavior (§11.3) |
| Size/type limits (5 MB, 5000 rows) | Verified implemented (reported) | `sheet-reader.ts` | — |
| Price providers (Yahoo, MFAPI), cache, batching, partial failure | Verified implemented (reported) | `tests/services.test.ts` | Cache is in-memory only |
| FX (Frankfurter) with single-flight, stale fallback, no hard-coded rate | Verified implemented (reported) | `tests/services.test.ts` group I | Not persisted |
| `POST /api/prices/refresh` | Verified implemented (reported) | `app/api/prices/refresh/route.ts`; `tests/prices-refresh.test.ts` (14) | Prisma mode only |
| Refresh Prices button; source/freshness column | Implemented but unverified | `components/ui/RefreshPricesButton.tsx`, portfolio page | **No browser test** (blocked by tool quota) |
| Float→Decimal migration (money `Decimal(19,4)`, qty `Decimal(18,6)`) | Verified implemented (reported) | `prisma/schema.prisma`; `tests/precision.test.ts` | Applied via `db push --accept-data-loss` on dev DB only; no production backfill path exercised |
| `Account` entity, CRUD, soft-close, migration of flat strings | Verified implemented (reported) | `account.service.ts`; `tests/account.service.test.ts` (19) | No UI confirmed |
| Paired transfers (`transferGroupId`, atomic create/delete) | Verified implemented (reported) | `transaction.service.ts` | Transfer exclusion from income/expense reported (LEDGER-007) |
| Multi-profile (`Profile`) | Planned → **Deferred** | ADR-009 | See D-02 |
| Portfolio allocation/risk/summary | Verified implemented (reported) | `tests/portfolio.service.test.ts` (7) | Rebalance plan untested |
| Health score (existing 0–10 scale) | Verified implemented (reported) | `tests/healthscore.service.test.ts` (5) | Scale conflict, D-05 |
| Net worth, snapshots, dashboard | Implemented but unverified | services exist | No tests; snapshot immutability untested |
| Transactions, budgets, goals, insights services | Implemented but unverified | services exist | No unit tests |
| **AI advisor (MiniMax)** | **Blocked** | `src/services/ai/`, `AIConversation` | **MiniMax access expired (user-stated)**; existing prompts/actions not inspected here; no PII gateway test |
| Manual asset CRUD with validated forms | Partial | `app/api/assets` exists | Field set per class, validation, UI forms, dependent-total refresh not verified |
| XIRR/CAGR, amortization, calculators, CAS PDF, ImportBatch persistence, FXRate/PriceHistory, Redis, export/deletion, cron | Planned | none | Roadmap |
| Rate limiting, structured redacted logging | Planned | none | Phase 9 |

**Known stale statements in older docs (do not propagate):** CODEBASE_AUDIT says amounts are `Float` and no `Account` exists (now false); v2.0 says CAS parser/XIRR/health score are "✅ implemented" (false); v2.0 "real-time" pricing (actual: polled/EOD/delayed); ADR-007 "build blocked" (build later passed); ADR-005 "Decimal deferred" (done in DATA-001).

---

## 4. Core user journeys and functional feature catalogue

### 4.1 Journeys
1. Sign in → empty dashboard → add first asset manually or import a statement.
2. Import preview → review new/updated/unchanged/proposed-removal rows → commit → portfolio updates.
3. Refresh prices → see updated/failed/unsupported counts, source and freshness per holding.
4. Edit an asset → totals, allocation, P&L and dashboard change.
5. Record income/expense/transfer; track budgets.
6. Set targets → see drift → request AI explanation of deterministic rebalance plan.
7. Export data / delete account.

### 4.2 Catalogue (status → dependencies → acceptance)

| ID | Feature | Status | Depends on | Acceptance summary |
|---|---|---|---|---|
| F-01 | Auth, per-user isolation | Impl. unverified | Clerk, DB | Cross-user access → 404; unauth → 401 (tests, P1) |
| F-02 | Dashboard / net worth | Impl. unverified | F-03, F-12 | Single shared calculator; matches portfolio totals (§10.5) |
| F-03 | Asset register + manual CRUD | Partial | schema | §10.1–10.3, ASSET-* |
| F-04 | Liabilities | Partial | — | CRUD; amortization Planned (F-14) |
| F-05 | Accounts | Verified (reported) | — | CRUD, soft-close, delete safety |
| F-06 | Transactions & transfers | Verified (reported) | F-05 | Transfer net-worth neutral, atomic |
| F-07 | Budgets (80%/100% alerts) | Impl. unverified | F-06 | Usage = eligible spend / limit; transfers excluded |
| F-08 | Goals | Impl. unverified | F-03 | Past-deadline/zero-month guards |
| F-09 | Snapshots | Impl. unverified | F-02 | Immutable once written |
| F-10 | Insights | Impl. unverified | F-06 | Uses shared aggregation |
| F-11 | Health score | Verified (reported, 0–10) | F-02,F-06,F-04 | Deterministic; scale decision D-05 |
| F-12 | Price refresh | Verified (reported) | providers | ADR-001/003/004 behavior |
| F-13 | FX conversion | Verified (reported) | Frankfurter | Dated, never fabricated |
| F-14 | Loan amortization / prepayment | Planned | Decimal | §10.7 reference vectors |
| F-15 | Calculators (SIP, step-up, lumpsum, EMI, CAGR, FD, XIRR, FIRE) | Planned | — | Client-side; validated inputs |
| F-16 | XIRR / CAGR portfolio returns | Planned | ledger of dated flows | §10.6 |
| F-17 | Rebalancing guidance | Partial (plan code untested) | targets, F-03 | §13.9 |
| F-18 | Broker imports (4 formats) | Verified (reported) | adapters | §11 |
| F-19 | CAS PDF import | Planned | sample files | §11.8 |
| F-20 | Transaction/bank-statement CSV import | Planned | account model | §11.7 |
| F-21 | AI advisor (Gemini/Grok) | Blocked → Planned migration | §13 | §13 |
| F-22 | Export / deletion | Planned | — | §14.6 |
| F-23 | Notifications, recurring, cron | Planned | — | §15.4 |
| F-24 | Privacy mode | Impl. unverified | `User.privacyMode` | Must mask every monetary figure incl. AI output |
| F-25 | Settings (currency, privacy) | Impl. unverified | — | — |

Planned benchmark features retained from `audit.md` (not yet scoped): category rules, recurring templates, bulk recategorization, transaction cloning, app lock, PWA install, essentials (insurance/emergency fund), financial profiles/shared access, weekly summary email, SWP/retirement calculators. These stay in the backlog (§18, Phase 8–9).

---

## 5. Navigation and page/route inventory

### 5.1 Conventions (conflict resolved)
v2.3 proposed `/api/v1/*` and many new pages. The repository uses unversioned `/api/<resource>` routes and a `(dashboard)` group. **Decision (D-01): keep the existing `/api/<resource>` convention**; do not introduce `/api/v1` without a deliberate migration.

### 5.2 Existing (reported)
Pages: `app/(dashboard)/portfolio/page.tsx` plus dashboard, assets, transactions, budgets, goals, insights/health, AI pages (exact set to be enumerated in P0-R03).
API: `assets`, `portfolio` (GET only), `import` (GET support matrix / POST), `prices/refresh` (POST), `transactions`, `budget`, `goals`, `dashboard`, `net-worth`, `health-score`, `insights`, `ai`, `accounts`, `accounts/[id]`, `accounts/[id]/close`, `accounts/migrate`.

### 5.3 Target additions (Proposal unless noted)
`/assets/new`, `/assets/[id]` (edit/detail incl. price source/freshness); `/imports/history` (only if batch persistence adopted, D-04); `/liabilities/[id]` (schedule); `/calculators/*`; `/settings/data` (export/deletion); AI settings/diagnostics under `/api/ai/*` (§13).

### 5.4 Responsive/accessibility
Desktop sidebar + header with privacy toggle; mobile bottom nav; tables degrade to cards; WCAG 2.1 AA targets; keyboard-operable controls; chart text alternatives; no color-only meaning (acceptance in Phase 9).

---

## 6. Technology stack and system architecture

```
Browser (Next.js RSC + client components)
   │ HTTPS, Clerk session
Next.js Route Handlers  ── auth (getCurrentUserId) ── Zod validation ── handleError()
   │
Services (src/services): asset, import, portfolio, networth, transaction, account,
   budget, goal, healthscore, insights, dashboard, price-engine, fx, ai
   │                      │                          │
Prisma/PostgreSQL     Providers (adapters)       AI gateway (§13)
                      Yahoo · MFAPI · Frankfurter   Gemini · Grok (server-side only)
```
- Storage modes: Prisma (target) and Firestore (legacy). Features not implemented for Firestore must return 501 via `assertPrismaMode()`; no silent removal of a mode (DATA-002).
- Cache: in-memory TTL (`src/lib/cache.ts`); persistent cache is a Phase 4 target.
- Deployment target: Vercel + managed Postgres (Neon/Supabase) (Proposal; unverified in repo).

---

## 7. Frontend conventions and component architecture
- RSC by default; client components only for interaction (`RefreshPricesButton`, forms, charts).
- Server state: server fetch; TanStack Query only where already adopted (verify in P0-R03). UI state: Zustand for privacy mode/currency if present.
- **Formatting boundary:** services return plain `number`/string-serialized values; `Prisma.Decimal` never reaches JSON or components. `formatINR`/`formatPercent` accept `number | Decimal`.
- INR uses `en-IN` grouping; USD `en-US`. Tabular numerals in tables.
- Required UI states for every data view: loading, empty, success, partial failure, error, unsupported.
- Privacy mode masks all monetary values consistently, including AI replies and chart tooltips.
- Page refresh after mutations: currently `window.location.reload()` (ADR-008); target `router.refresh()` + revalidation (Phase 8).

---

## 8. Backend APIs and service boundaries

### 8.1 API conventions
- Auth: `getCurrentUserId()` on every handler; unauthenticated → 401; resource not owned → **404**.
- Validation: Zod on all bodies/queries; reject unknown enum values.
- Envelope: errors via `handleError()` (`AppError` codes); no stack traces/SQL/provider raw errors to clients; include a correlation id (Proposal).
- Money serialization: numbers rounded intentionally (2 dp display, 4 dp stored) or decimal strings; never raw floats from arithmetic.

### 8.2 Service ownership
| Service | Responsibility |
|---|---|
| `AssetService` | CRUD, `toPL`, `importHoldings`, `applyPrices` |
| `ImportService` | preview/commit orchestration over adapters |
| `PriceEngineService` | provider routing, cache, batching, classification |
| `FxRateService` | rate lookup, single-flight, stale fallback |
| `PortfolioService` | allocation, risk, summary, rebalance plan |
| `NetWorthService` | totals, snapshots |
| `TransactionService` / `AccountService` | ledger, transfers, accounts |
| `BudgetService`, `GoalService`, `HealthScoreService`, `InsightsService`, `DashboardService` | as named |
| `FinancialEngine` (Planned, `src/lib/finance/*`) | pure XIRR, CAGR, EMI, amortization, drift/rebalance |
| `AIService` (to be refactored, §13) | context builder, redaction, provider routing, validation |

### 8.3 Key endpoints (existing unless marked)
| Endpoint | Behavior |
|---|---|
| `GET /api/portfolio` | Reads stored values only; **never** triggers refresh |
| `POST /api/prices/refresh` | Auth, Prisma-only; STOCK+MUTUAL_FUND sent to engine; returns `updated[]`, `failed[]`, `unsupported[]`, `lastRefreshedAt`, `fx` |
| `GET/POST /api/import` | Support matrix / preview+commit |
| `POST /api/accounts/migrate` | Idempotent flat-string → Account migration |
| `POST /api/transactions` (transfer variant) | Paired atomic legs |
| `/api/assets` (+ Proposal `PATCH/DELETE /api/assets/[id]`) | Manual CRUD (§10.1) |
| Proposal `GET /api/ai/providers/health`, `POST /api/ai/chat`, `POST /api/ai/rebalance-explain` | §13 |
| Proposal `GET /api/export`, `DELETE /api/account` | §14.6 |

---

## 9. Database and domain model

### 9.1 Authority
`prisma/schema.prisma` in the repo is authoritative for field names. This section states **required semantics**; do not infer fields beyond those in §3 sources.

### 9.2 Entities (reported to exist)
`User`(clerkId, email, currency, privacyMode) · `Asset`(type, name, symbol, isin, exchange, folio, quantity `Decimal(18,6)`, avgBuyPrice `Decimal(19,4)`, currentPrice `Decimal(19,4)?`, currency, account/accountId, importSource, importKey, priceSource, priceUpdatedAt, deletedAt) · `Transaction`(type, amount, category, date, account link, `transferGroupId`, deletedAt) · `Account`(user-owned, name, type, currency, lifecycle/closed) · `Liability`(principal, outstanding, interestRate, monthlyEMI, dueDate) · `Goal` · `Budget`(unique user+category+month+year) · `Snapshot`(unique user+date) · `AllocationTarget`(unique user+assetType) · `AIConversation`(action, messages JSON, contextSnapshot JSON).

### 9.3 Integrity constraints (required)
1. Every user-owned row has `userId`; indexes on `(userId, deletedAt)` and ownership joins.
2. Asset import identity unique per `(userId, importKey)` where `importKey` includes the account component (DATA-006). **Verify the exact constraint and key format** (P0-R04); ADR-006 still says OPEN while progress says DONE.
3. Transfers: both legs share `transferGroupId`; create/delete in one DB transaction; no one-sided TRANSFER.
4. Soft-delete (`deletedAt`) for assets/transactions; hard purge only via account deletion flow.
5. Snapshots never rewritten after creation.
6. Money `Decimal(19,4)`; quantity `Decimal(18,6)`; percentages/counts not converted.

### 9.4 Proposed additions (Proposals)
- `FXRate(base, quote, rate, asOfDate, fetchedAt, source)` unique `(base, quote, asOfDate)` — Phase 4.
- `AssetPriceHistory(identifier, asOfDate, price, currency, source)` unique `(identifier, asOfDate)` with retention policy — Phase 4.
- `ImportBatch`/`ImportStagingRow` — only if D-04 chooses persistence.
- `LoanAmortizationSchedule` — only if regeneration proves insufficient (DEBT-003).
- `TransactionImportKey` (accountId + dedup hash + occurrence index) — Phase 3/7 if F-20 adopted.
- `AIRequestLog` (provider, model, latency, outcome code, **no prompt/response body**) — Phase 5 (optional).

### 9.5 Migration policy
`db push` is acceptable on disposable/dev databases only. Before any production use: introduce versioned migrations (baseline from the current schema), take a backup, rehearse on a copy, document rollback. No `--accept-data-loss` or `db:reset` against valuable data.

---

## 10. Portfolio valuation and financial calculation rules

### 10.1 Asset fields by class (manual CRUD)
Common: name*, type*, currency* (default INR), account (optional), tags, notes.
| Class | Required | Optional/metadata | Valuation |
|---|---|---|---|
| STOCK (IN/US) | symbol or ISIN, quantity, avgBuyPrice | exchange | quantity × currentPrice × fx |
| MUTUAL_FUND | scheme name, ISIN or scheme code, folio, quantity (units), avgBuyPrice | — | units × NAV × fx |
| CRYPTO | symbol, quantity, avgBuyPrice | wallet | priced only if a provider is added; else manual |
| FIXED_DEPOSIT / RD / EPF / PPF / NPS / SGB / BONDS | invested amount, current value | rate, start/maturity date, institution | **manual valuation** |
| REAL_ESTATE / GOLD / VEHICLE / OTHER | invested amount, current value | purchase date, notes | **manual valuation** |
| CASH | balance | institution | manual valuation |

**Manual-valuation representation (Proposal, D-06):** store as `quantity = 1`, `avgBuyPrice = invested`, `currentPrice = current value`, `priceSource = MANUAL`, `priceUpdatedAt = entry time`, with type-specific metadata (maturity date, rate) in additional validated fields/JSON. Confirm against schema before building.

### 10.2 Unit price vs position value
- `unitPrice` = `currentPrice` (per share/unit/NAV, in native `currency`).
- `positionValueNative = quantity × unitPrice`.
- `positionValueDisplay = positionValueNative × fx(native→INR)`; INR needs no FX; if FX unavailable → value flagged `FX_UNAVAILABLE`, **excluded from INR totals with a visible warning, never converted with a fabricated rate**.
- `invested = quantity × avgBuyPrice`; `unrealizedPnL = positionValueNative − invested` (shown native and converted); `pnlPct = pnl / invested` (guard zero invested).

### 10.3 Valuation status and freshness (required labels)
`priceSource ∈ {YAHOO, MFAPI, STATEMENT, MANUAL, COST_BASIS}`. Derived `valuationStatus`: `LIVE`/`STATEMENT`/`MANUAL`/`COST_BASIS`/`STALE`/`FX_UNAVAILABLE`.
- A failed refresh **never** overwrites `currentPrice`, `priceSource` or `priceUpdatedAt` (ADR-003).
- `COST_BASIS` fallback is allowed only when no statement/market/manual price exists, is explicitly labelled, and is excluded from "market value" claims in AI context (flagged low confidence).
- `STALE` threshold (Proposal): stocks > 3 trading days; MF NAV > 5 days; configurable.
- Editing an asset updates the record and all dependents (portfolio, allocation, net worth, dashboard, goals) via the shared calculators; tests must prove it (ASSET-006).

### 10.4 Rounding
Decimal arithmetic end-to-end; round half-up to 2 dp only at display/serialization; stored precision per §9.3.

### 10.5 Net worth
`NetWorth = Σ(position values in INR, excluding FX_UNAVAILABLE) − Σ(outstanding liabilities in INR)`. **One** implementation shared by dashboard, `/api/net-worth`, portfolio API and page (ANALYTICS-001). Transfers never alter net worth.

### 10.6 Returns
- **CAGR** = (End/Start)^(1/years) − 1; require start > 0, years > 0.
- **XIRR:** Σ Cᵢ/(1+r)^((dᵢ−d₀)/365) = 0; Newton–Raphson, max 100 iterations, |NPV| < 1e‑6, derivative guard < 1e‑9 → bisection on [−0.99, 5.0]; require ≥1 negative and ≥1 positive flow; on failure return `null` + reason, show absolute return instead. (v2.2's 0.0001 tolerance is superseded.) Reference: −100,000 on 2025‑01‑01, +115,000 on 2026‑01‑01 → 15.00% (365-day year).
- Realized P&L / STCG-LTCG: Planned, only where buy/sell/dividend records exist; holdings snapshots alone cannot produce them.

### 10.7 Loans
Monthly rate `r = annual/12/100`. If `r = 0`, `EMI = P/n`; else `EMI = P·r(1+r)^n/((1+r)^n−1)`. Month t: interest = balance·r; principal = EMI − interest; final payment adjusts for rounding. Reference (to be **independently recalculated** in tests, not copied): ₹5,000,000 @ 8.5% / 240 months → EMI ≈ ₹43,391.17; month‑1 interest ≈ ₹35,416.67, principal ≈ ₹7,974.50. Tolerance ±0.01 per payment; total repayment = Σ payments.

### 10.8 Budgets, savings, goals
Budget usage = eligible expense / limit (limit 0 → no percentage, flagged). Alerts at ≥80% and ≥100%, once per threshold per month. Savings rate = (income − expenses)/income, income 0 → undefined. Goal monthly required = remaining / months left, months ≤ 0 → status "past due", no division.

### 10.9 Allocation
Allocation % = class value / total eligible value; empty total → empty result, no NaN. Allocation targets must sum to 100% (±0.01) to be actionable.

---

## 11. Imports, idempotency, duplicate detection and reconciliation

### 11.1 Supported matrix (only these are claimed)
| Broker | Class | Formats | Identity (`importKey` body) | Status |
|---|---|---|---|---|
| Groww | Indian stock | xlsx, csv | ISIN | Verified (reported) |
| Groww | Mutual fund | xlsx, csv | ISIN + folio | Verified (reported) |
| INDmoney | US stock | xls (BIFF8), xlsx | symbol (USD) | Verified (reported) |
| INDmoney | Mutual fund | xlsx, csv | ISIN + folio | Verified (reported) |
| INDmoney | Indian stock | — | — | Unsupported (explicit error) |
| Groww F&O, INDmoney FD/cash, Zerodha, Upstox, ICICI Direct, CAS PDF | — | — | — | Unsupported until fixtures exist |

Unsupported combinations must return a descriptive safe error; never silently mis-map.

### 11.2 Instrument vs position identity
- **Instrument identity:** ISIN (preferred) → exchange-qualified symbol → scheme code; never display name alone, never ticker alone across exchanges.
- **Position identity:** `broker | assetClass | instrument identity | account/folio`. Same instrument in two folios or two accounts = **two positions**. Same display name with different ISINs = different instruments.

### 11.3 Idempotency keys
`importKey = BROKER|ASSET_CLASS|IDENTITY[|FOLIO]|ACCOUNT`. Reported state: the account component was added in DATA-006 using the **account name**.
**Risks/decisions:** (a) renaming an account would change keys and cause duplicates on re-import → prefer immutable `accountId` (D-03); (b) verify `@@unique([userId, importKey])` vs `(userId, accountId, importKey)` and ADR-006's stale "OPEN" status (P0-R04). Acceptance: IMP-T3/T4 below.

### 11.4 Flow
1. Upload (multipart) → size/type/magic-byte checks → read into memory only.
2. Adapter parse → normalized holdings + row-level issues.
3. **Preview** (no writes): classify each row `NEW | UPDATED | UNCHANGED | ERROR`, and `PROPOSED_REMOVAL` for existing positions of same user+account+broker+class absent from the file (only when `replaceMissing`).
4. User confirms selection → **Commit** in one DB transaction (selected rows only).
5. Post-commit price enrichment is separate; its failure never fails the import.

### 11.5 Update vs append semantics
Holdings imports are **snapshots**: quantity/avg price on an existing position are **set** to the statement values (never added), so re-import is a no-op. Transaction imports (F-20, Planned) **append** with dedup (§11.7). Corrected statement for same account: updates changed positions; missing positions soft-deleted only with `replaceMissing`; reappearing positions revived (`deletedAt = null`).

### 11.6 Safety gates
- Any critical parse error (malformed rows, reconciliation mismatch beyond tolerance) **disables** `replaceMissing` deletion for that commit and surfaces row-level errors; valid rows may still be committed only if the user explicitly selects them; no unintended partial commit of malformed rows.
- Duplicate row within one file: second occurrence rejected with an error, not merged.
- Preview never mutates holdings. Oversize/corrupt/unsupported files fail with zero writes.
- Raw bytes and passwords never written to disk or logs (test required: IMPORT-003).

### 11.7 Transaction import dedup (Proposal, Planned)
`dedupKey = sha256(userId|accountId|date|signedAmount|currency|normalizedDescription|occurrenceIndex)` where `occurrenceIndex` counts identical tuples within the same file so legitimate identical same-day transactions survive, and re-import of the same file yields the same keys. Unique on `(userId, accountId, dedupKey)`. Never global (cross-account identical rows must coexist).

### 11.8 CAS PDF (Planned, Blocked on samples)
In-memory decrypt/parse (`pdfjs-dist` or equivalent) only after real anonymized CAMS/KFintech samples and password UX are agreed (D-07). Position identity ISIN+folio; password never stored/logged; memory-limit behavior on serverless must be tested.

### 11.9 Persistence of preview batches (D-04)
Current preview is in-memory/stateless. Persisting `ImportBatch`/`ImportStagingRow` is adopted **only** if rollback/audit requirements justify it; if adopted: ownership, expiry, status machine, cleanup, and rollback semantics must be specified first.

### 11.10 Required import tests
IMP-T1 repeated identical import → 0 new/updated rows, counts and quantities unchanged. IMP-T2 overlapping imports (superset/subset file). IMP-T3 same ISIN in two folios → two positions. IMP-T4 same instrument, two accounts → two positions. IMP-T5 same display name, different ISIN → distinct. IMP-T6 malformed rows → row errors, no deletion pass. IMP-T7 partial DB failure → full rollback. IMP-T8 duplicate row in one file. IMP-T9 corrected statement updates quantity without doubling. IMP-T10 no disk writes. IMP-T11 import then manual edit then re-import (defined overwrite policy, D-08). IMP-T12 existing adapter suite unchanged.

---

## 12. Market pricing, NAV, FX, cache and freshness

### 12.1 Providers (implemented, reported)
Stocks: Yahoo Finance via `yahoo-finance2` (batched, ISIN→ticker lookup, timeouts, rate-limit classification). Mutual funds: MFAPI (`MFAPI_BASE_URL`) with name/ISIN matching; ambiguous schemes refused. FX: Frankfurter (`FX_API_BASE_URL`). **Conflict resolved:** v2.3 named Yahoo for FX; the repo uses Frankfurter — keep Frankfurter; changing provider requires an ADR.

### 12.2 Behavior
- Pull model: refresh on explicit user action (`POST /api/prices/refresh`) and (Phase 4) scheduled jobs; never on page render.
- MF NAV is end-of-day; stock quotes are delayed/EOD — UI must not say "real-time".
- Persist only finite, positive results. Failure classes returned: `TIMEOUT`, `RATE_LIMIT`, `NOT_FOUND`, `INVALID`, `UNSUPPORTED`, `FX_UNAVAILABLE`.
- Unsupported types (CRYPTO, REAL_ESTATE, CASH, others) reported, never invented.
- Cache TTL via `STOCK_PRICE_TTL_SECONDS` (300) and `MF_NAV_TTL_SECONDS` (21600); failed results are not cached; same ticker in a batch → one provider call.
- FX: INR needs no call; USD→INR uses a dated rate shown in UI; provider down → last known rate flagged `stale`; no cache → `FxUnavailableError`.

### 12.3 Target (Phase 4)
Persistent shared cache (Upstash Redis, optional in dev, in-memory fallback); persisted `FXRate` and `AssetPriceHistory` with retention; circuit breaker/backoff; snapshots keep their own frozen values; scheduled refresh only after auth (`CRON_SECRET`), idempotency, rate limits.

### 12.4 Acceptance
Provider-mocked tests for success, timeout, 429, invalid/zero, partial, unsupported, auth isolation, persistence; cache hit/miss/expiry; outage preserves last-known-good with stale metadata; no hard-coded price or FX rate anywhere.

---

## 13. AI advisor: Gemini and Grok providers, existing prompts, privacy, fallbacks, rebalancing

### 13.1 Status and migration goals
Current AI uses MiniMax (`src/services/ai/`, `AIConversation`), which is **no longer usable**. Target: provider-agnostic gateway with Gemini and Grok adapters, **without** breaking existing routes, conversation UI, system prompts, templates, direct-prompt actions, quick actions or response rendering. **The exact existing prompts/actions were not supplied** — task AI-001 must inventory them from the repository and freeze them verbatim in tests/snapshots before any change. Do not rewrite or "improve" them during migration.

### 13.2 Provider facts — unverified
Not verified in this consolidation: model names, free-tier availability, quotas, rate limits, pricing, data-retention/training policies, JSON-mode/structured-output support, safety-filter behavior, endpoint shapes for Gemini and xAI Grok. **AI-002 must check current official documentation** and record verified facts in the ADR log. Until then: no model name is hard-coded, no free tier is assumed, and either provider may be absent or fail.

### 13.3 Provider abstraction
```ts
interface AIProvider {
  readonly id: "gemini" | "grok";
  isConfigured(): boolean;                         // key + model present
  generate(req: AIRequest, opts: { signal: AbortSignal }): Promise<AIResult>;
  health(): Promise<ProviderHealth>;               // cheap, no user data
}
type AIRequest = { system: string; messages: {role:"user"|"assistant"; content:string}[];
                   responseSchema?: ZodSchema; maxOutputTokens?: number; temperature?: number };
type AIResult  = { ok:true; text:string; provider:string; model:string; latencyMs:number }
               | { ok:false; code: AIErrorCode; retryable:boolean; provider:string };
type AIErrorCode = "NOT_CONFIGURED"|"AUTH"|"QUOTA"|"RATE_LIMIT"|"TIMEOUT"|"NETWORK"|"SAFETY_BLOCK"|"BAD_OUTPUT"|"UNKNOWN";
```
Adapters (`gemini.provider.ts`, `grok.provider.ts`) own request/response mapping, error classification and nothing else. A legacy `MiniMaxProvider` may remain only as a disabled, non-default adapter or be removed (D-09); the expired key must not be required for startup.

### 13.4 Configuration and routing policy
Env (names in §17): `AI_PRIMARY_PROVIDER`, `AI_FALLBACK_PROVIDER` (optional, may be `none`), per-provider key and model, timeout, retries.
- Keys server-side only; never `NEXT_PUBLIC_*`; never logged; never returned.
- Primary tried first. Retry only retryable errors (timeout/network/429/5xx) with exponential backoff + jitter, max 2 retries, per-attempt timeout.
- **Fallback is opt-in and explicit:** used only if `AI_FALLBACK_PROVIDER` is set **and** the user/setting permits sending data to it (`aiFallbackConsent`, Proposal); the UI/response states which provider answered. One request is never sent to two providers concurrently; a late response from an abandoned attempt is discarded (AbortController) so no duplicate replies are stored.
- No provider configured / all failed → deterministic fallback (§13.7) and a clear notice; never a fabricated AI answer.
- Safe user-facing error messages per code (table §13.10); provider raw errors only in redacted logs.
- Provider health endpoint reports configured/not-configured and last probe result, no secrets.

### 13.5 Context builder
Builds a minimal, access-validated context **from deterministic services**, per action: net worth, asset-class allocation %, targets and drift, liabilities summary (type, rate, EMI, outstanding), monthly income/expense/savings rate, goals (name, target, months left, required monthly), risk preference and time horizon if set, valuation-confidence flags, `asOf` timestamps. Rules: user-scoped queries only; include only fields the action needs; aggregate instead of itemizing where possible; round amounts sensibly; cap item counts and size.

### 13.6 Data minimization / redaction
| Item | Handling |
|---|---|
| Name, email, Clerk/user ids | Removed entirely |
| PAN, Aadhaar, phone | Pattern-removed; never in context sources |
| Account/folio numbers | Not included; if present in free-text, replaced with `[REDACTED]` |
| Institution names | Replaced by generic class labels in aggregates |
| Holding names/ISINs | Included only for holding-specific actions; otherwise aggregated by class |
| Amounts, percentages, rates, dates | **Retained** — necessary for financial guidance |
| Free-text user message | Regex scrub for emails/phones/PAN/long digit runs |
This is minimization, **not anonymization**: unique amounts and holdings can be re-identifying. The product must not claim anonymity. Tests assert on the actual serialized outbound request body (AI-005).

### 13.7 Deterministic fallback (no LLM)
When no provider succeeds: return the computed facts (net worth, allocation vs targets, drift table, rebalance amounts, health score breakdown, budget status, loan metrics) in templated text with an explicit banner: "AI explanation unavailable — showing calculated results." The AI route and UI must stay usable; dashboard/portfolio never depend on AI.

### 13.8 Structured outputs and validation
Prompts request JSON conforming to Zod schemas; responses are parsed and validated at runtime; bounds checked (e.g., percentages 0–100, no negative amounts where invalid, array length caps); on parse/validation failure → one repair retry at most → else deterministic fallback with `BAD_OUTPUT`. Free-text actions (existing chat) keep their current rendering; their output is length-capped and scanned for guaranteed-return language.
```ts
AdviceResponse = { summary:string; observations:{title,detail}[]; suggestions:{action,rationale,risk}[]; assumptions:string[]; limitations:string[] }
RebalanceExplanation = { overview:string; perClass:{assetClass:string; commentary:string}[]; risks:string[]; assumptions:string[] }
```
**Numbers in LLM output are never trusted**: any monetary/percentage figure shown to users comes from deterministic results; the LLM schema carries commentary only, and rendering substitutes computed values.

### 13.9 Rebalancing (deterministic)
Inputs: eligible holdings with valuation status, per-class current value, targets (sum = 100% ±0.01 else error `TARGETS_INVALID`), optional new cash, mode (`CASH_ONLY` default | `ALLOW_SELLS`), drift band (default 5 pp, configurable), min trade size, excluded assets.
Algorithm (Decimal): `T = Σ eligible value (+cash)`; `target_i = w_i·T`; `delta_i = target_i − current_i`. `CASH_ONLY`: buy only underweight classes, scale `max(delta_i,0)` proportionally to available cash; unspent cash reported. `ALLOW_SELLS`: sells = overweight classes beyond band. Classes inside the band → no action. Output: per-class current %, target %, drift pp, suggested amount, direction, residual cash, assumptions.
Rules: assets with `COST_BASIS`/`STALE`/`FX_UNAVAILABLE` are flagged and reduce confidence (excluded from eligible value if FX unavailable, with warning); fees, taxes (STCG/LTCG), exit loads, lot constraints are **not modeled** and the output says so; per-instrument trades are Proposal and need instrument eligibility rules; suggestions are advisory — no execution endpoint exists.

### 13.10 User-facing errors
| Code | Message intent |
|---|---|
| NOT_CONFIGURED | "AI isn't set up. Calculated results are shown below." |
| AUTH | "AI service credentials were rejected. Contact the administrator." (no key detail) |
| QUOTA / RATE_LIMIT | "AI is busy or over quota. Try later." |
| TIMEOUT / NETWORK | "AI didn't respond in time." |
| SAFETY_BLOCK | "The AI couldn't answer that request." |
| BAD_OUTPUT | "The AI response was unusable; showing calculated results." |
| All providers failed | combined notice + deterministic output |

### 13.11 Disclosures
Every AI view states: educational assistance, not regulated or personalized investment advice, no guaranteed returns, no claim of SEBI/SEC registration; AI-generated content may be wrong; verify before acting.

### 13.12 Persistence
`AIConversation` stores sanitized messages and the deterministic `contextSnapshot` (post-redaction). Provider/model recorded per reply; legacy MiniMax conversations remain readable.

### 13.13 Required AI tests
Adapter unit tests (mocked HTTP) for success, each error class, malformed JSON; prompt/template snapshot tests proving existing prompts unchanged; context-builder scoping (user A never sees user B); outbound-payload PII tests; schema validation incl. bounds and malformed output; fallback matrix (primary fail→fallback consented / not consented / none); no duplicate persistence on late response; timeout/backoff/429 behavior (fake timers); missing key → startup OK; rebalancing arithmetic vectors (sums to residual, targets≠100, empty portfolio, single class, cash-only scaling); AI outage never breaks other routes.

---

## 14. Security, authorization, privacy and secrets

### 14.1 Authn/authz
Clerk session on every non-public route; handler-level `getCurrentUserId()`; services always filter by `userId` (and ownership joins for accounts/transfers); cross-user → 404; account-closed/soft-deleted rows excluded by default. Required tests: unauthenticated 401 on each route group; cross-user 404 on assets, accounts, transactions, goals, AI conversations.

### 14.2 Secrets
All secrets in env vars only; `.env.example` placeholders; none in repo, logs, client bundles, error bodies or docs. AI keys: server only.

### 14.3 Files
In-memory parsing only; limits (5 MB, 5000 rows); no raw bytes/passwords logged or stored; filenames not trusted.

### 14.4 Logging
Structured, redacted logs (route, userId hash, status, duration, error code); never request bodies containing financial rows, passwords, AI prompts.

### 14.5 Rate limiting (Planned)
Per-user limits on import, refresh, AI endpoints (values configurable; v2.3's 5/min import, 10/min AI are proposals).

### 14.6 Export and deletion (Planned)
`GET` export (JSON/CSV) of all user-owned data, authorized, schema documented. Deletion: confirmation, cascade review, post-delete verification with a test user; soft-delete used day-to-day, hard purge on account deletion. No deletion SLA claimed until implemented.

---

## 15. Error handling, observability, performance and background work

### 15.1 Errors
`AppError` hierarchy; consistent client error shape; partial-success responses for refresh/import (never HTTP 200 with hidden failures).

### 15.2 Observability
Redacted structured logs; health check; Sentry or similar **only if approved** (OPS-006) with PII scrubbing.

### 15.3 Performance budgets (Proposals)
Portfolio API p95 < 300 ms on ≤ 500 holdings (no external calls); import preview < 3 s at 1,000 rows; refresh bounded concurrency/timeouts (`PROVIDER_TIMEOUT_MS`, `ENRICH_TIMEOUT_MS` 25 s).

### 15.4 Background jobs (Planned)
Vercel Cron/QStash → authenticated routes (`CRON_SECRET`): daily NAV/stock refresh, daily FX, snapshots, budget/EMI alerts, recurring transactions. Each job idempotent (date-keyed), retry-safe, bounded.

---

## 16. Testing strategy and feature acceptance criteria

### 16.1 Layers
Unit (Vitest): pure math, adapters, redaction, schemas. Service tests with mocked Prisma/providers. Integration against a disposable PostgreSQL for constraints/transactions (Planned; current tests mock). E2E (Playwright, Planned): sign-in, asset CRUD, import, refresh, AI fallback.

### 16.2 Gates
Before any phase is marked complete: targeted tests + full `npm test`, `npm run typecheck`, `npm run lint`, and (for schema/RSC changes) `npm run build` — real outputs recorded in `IMPLEMENTATION_PROGRESS.md`.

### 16.3 Mandatory acceptance vectors
| ID | Case | Expected |
|---|---|---|
| T-MATH-1 | 0.1+0.2 with Decimal | 0.3 exact |
| T-XIRR-1 | −100,000 → +115,000 after 365 days | 15.00% ±1e‑6 |
| T-XIRR-2 | all-positive flows | `null` + reason |
| T-EMI-1 | 5,000,000 @8.5%/240 | EMI within ±0.01 of independent calc |
| T-EMI-2 | rate 0 | P/n |
| T-FX-1 | EUR→USD 1.0850 × USD→INR 83.50 (test fixture) | 90.5975 (only if cross rates adopted) |
| T-XFER-1 | transfer 50,000 | net worth delta 0; second leg failure rolls back both |
| T-ISO-1 | user B reads user A asset | 404 |
| T-SNAP-1 | edit asset after snapshot | snapshot unchanged |
| T-PRICE-1 | provider fails | stored price/source/timestamp unchanged |
| T-ASSET-1 | edit quantity/price | portfolio, allocation, net worth update |
| T-AI-1 | all providers down | deterministic output + notice, HTTP success path usable |
| T-AI-2 | outbound payload | contains no name/email/PAN/account number |

---

## 17. Environment-variable reference (placeholders only)

| Variable | Req. | Purpose / example |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://USER:PASSWORD@HOST:5432/DB` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | `pk_test_xxx` |
| `CLERK_SECRET_KEY` | Yes | `sk_test_xxx` |
| `USE_FIREBASE` | No | unset/`false` (legacy) |
| `STOCK_PRICE_TTL_SECONDS` | No | `300` |
| `MF_NAV_TTL_SECONDS` | No | `21600` |
| `PROVIDER_TIMEOUT_MS` | No | provider default |
| `ENRICH_TIMEOUT_MS` | No | `25000` |
| `MFAPI_BASE_URL` | No | `https://api.mfapi.in` |
| `FX_API_BASE_URL` | No | `https://api.frankfurter.app/v1` |
| `AI_PRIMARY_PROVIDER` | No (Proposal) | `gemini` \| `grok` \| `none` |
| `AI_FALLBACK_PROVIDER` | No (Proposal) | `gemini` \| `grok` \| `none` |
| `GEMINI_API_KEY` | No (Proposal) | `<set in secret store>` |
| `GEMINI_MODEL` | No (Proposal) | `<model id from provider docs>` |
| `XAI_API_KEY` | No (Proposal) | `<set in secret store>` |
| `XAI_MODEL` | No (Proposal) | `<model id from provider docs>` |
| `AI_TIMEOUT_MS` / `AI_MAX_RETRIES` | No (Proposal) | `20000` / `2` |
| `MINIMAX_API_KEY` | Deprecated | not required; remove from required list |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | No (Phase 4) | placeholders |
| `CRON_SECRET` | Phase 4+ | long random string |
| `SENTRY_DSN` | Optional | only if approved |

Rule: app must start with zero AI variables set.

---

## 18. Phased implementation roadmap

One roadmap. It **replaces** the phase numbering in `IMPLEMENTATION_PHASES.md` and v2.x roadmaps. Existing feature IDs are kept stable; new IDs are added. Order rationale: data integrity and user-visible correctness first; AI (currently broken by an expired provider) is pulled ahead of analytics because it is a visible regression and the deterministic fallback depends only on existing services; rebalancing follows because it needs the provider/fallback plumbing and shared valuation rules.

**Stabilization = Phases 0–1. New expansion = Phases 2–9.**

### Phase 0 — Reconciliation and verification (P0)
Depends on: repo access.
- `P0-R01` Obtain repo; record git state (initialize git or snapshot) and working-tree changes.
- `P0-R02` Run `npm test`, `typecheck`, `lint`, `build`; record real results; upgrade/downgrade statuses in §3.
- `P0-R03` Enumerate real pages/routes/components; confirm conventions (§5.1).
- `P0-R04` Inspect `schema.prisma`: exact `Asset`/`Transaction` constraints and `importKey` format; resolve ADR-006/DATA-006 discrepancy.
- `P0-R05` Locate/inspect `src/services/ai/` — inventory prompts, templates, actions, UI flows (feeds AI-001).
- **Exit:** statuses in this file match repo evidence; command log recorded.

### Phase 1 — Stabilize existing app (P0)
Depends on: Phase 0. *Done (reported):* PRICE-001–010 (UI unverified), DATA-001–008, LEDGER-001–009.
- `STAB-001` Manual browser test of Refresh Prices button and Source column.
- `STAB-002` Unauthenticated/cross-user tests for every route group (§14.1).
- `STAB-003` Unit tests for transaction, budget, goal, dashboard, networth, insights services.
- `STAB-004` Introduce versioned Prisma migrations baseline; backup/rollback doc (§9.5).
- `STAB-005` Integration tests on disposable Postgres for unique constraints and `$transaction` rollbacks.
- **Exit:** all green; no unprotected route; migration path documented.

### Phase 2 — Asset CRUD and valuation correctness (P0)
Depends on: Phase 1.
- `ASSET-001` Finalize asset taxonomy/validated field matrix (§10.1) and D-06.
- `ASSET-002` Zod schemas + API: create/read/update/delete (soft) with ownership.
- `ASSET-003` UI forms per class with validation, loading/error states.
- `ASSET-004` Valuation status/freshness derivation and display (§10.3).
- `ASSET-005` Manual valuation entry for non-market assets.
- `ASSET-006` Dependent recalculation tests (T-ASSET-1); shared net-worth/portfolio calculator (ANALYTICS-001 pulled forward).
- **Exit:** edit/delete reflected everywhere; no zero/fabricated valuations.

### Phase 3 — Idempotent imports and reconciliation (P0/P1)
Depends on: Phase 2, P0-R04. IDs: `IMPORT-001…010` (as in historical plan) plus:
- `IMPORT-011` Switch key account component to immutable `accountId` if D-03 approves, with key-migration script.
- `IMPORT-012` Implement IMP-T1…T12.
- `IMPORT-013` Decide/implement D-04, D-08 (manual-edit vs re-import policy).
- CAS (`IMPORT-008`), transaction CSV (`IMPORT-014`), extra brokers (`IMPORT-009/010`) only with real fixtures.
- **Exit:** IMP suite green; adapters unchanged.

### Phase 4 — Pricing, NAV, FX, persistence and freshness (P1)
Depends on: Phase 2–3. IDs `MARKET-001…010`; adds `FX-PERSIST` (FXRate), `PRICEHIST` (policy first). **Exit:** §12.4.

### Phase 5 — AI: Gemini/Grok providers, prompt preservation, privacy, fallback (P0 for AI)
Depends on: Phase 0 (P0-R05), Phase 1 (route tests). Can run in parallel with Phase 4 (independent files).
- `AI-001` Inventory + freeze existing prompts/actions/UI (snapshot tests).
- `AI-002` Verify current Gemini/Grok official docs; record facts as ADR.
- `AI-003` `AIProvider` interface, router, config, health endpoint.
- `AI-004` Gemini and Grok adapters with error classification.
- `AI-005` Context builder + redaction + outbound payload tests.
- `AI-006` Zod response schemas, validation, repair-once policy.
- `AI-007` Deterministic fallback + UI notices + disclosures.
- `AI-008` Remove MiniMax as required dependency; legacy conversation compatibility.
- `AI-009` Fallback consent setting; no double-send.
- **Exit:** §13.13 green; app boots with no AI keys.

### Phase 6 — Deterministic portfolio analytics and rebalancing (P1)
Depends on: Phase 2, 4, 5. `ANALYTICS-001…009` plus `REBAL-001` (algorithm §13.9 as pure function), `REBAL-002` (API/UI), `REBAL-003` (AI explanation using computed plan). **Exit:** pages agree on numbers; XIRR safe-fail; rebalance vectors pass.

### Phase 7 — Accounts, transactions, transfers, consistency (P1)
Depends on: Phase 1. *Mostly reported done (LEDGER-*).* Remaining: `LEDGER-010` account UI/association confirmation, `LEDGER-011` transfer edit semantics, `LEDGER-012` transaction import (F-20), category rules/recurring (backlog).

### Phase 8 — Dashboard, budgets, liabilities, goals, snapshots, health, calculators (P1/P2)
Depends on: Phases 2, 6, 7. `DEBT-001…007`, `CALC-001…003`, `PLAN-001…003`, `HEALTH-001…003` (resolve D-05), snapshots immutability, `router.refresh()` revalidation.

### Phase 9 — Security, accessibility, performance, deployment, docs, release (P1)
Depends on all. `OPS-001…010`: env docs, build/migration sequence, export, deletion, cron/notifications, monitoring (if approved), accessibility audit, rate limits, README, final acceptance report.

**Dependency summary:** 0 → 1 → 2 → 3; 1 → 5 (parallel with 3/4); 2+3 → 4; 2+4+5 → 6; 1 → 7; 2+6+7 → 8; all → 9.

---

## 19. Known limitations, unresolved decisions and risks

### 19.1 Open decisions
| ID | Decision | Current stance |
|---|---|---|
| D-01 | `/api/v1` vs unversioned routes | Keep unversioned |
| D-02 | Multi-profile | Deferred (ADR-009); accounts + tags used |
| D-03 | importKey account component: name vs immutable id | Open; recommend id |
| D-04 | Persist import batches | Open; default stateless |
| D-05 | Health score scale/pillars (existing 0–10 vs v2.0 5-pillar vs v2.3 4-pillar /100) | Open; no silent change to existing API/UI semantics |
| D-06 | Manual-valuation representation | Proposal §10.1 |
| D-07 | CAS password UX | Open; needs samples |
| D-08 | Manual edit vs later re-import precedence | Open; default: statement overwrites quantity/avg, manual price retained unless newer source |
| D-09 | Keep or delete MiniMax adapter | Open; default remove from required path |
| D-10 | Fallback provider consent model | Proposal §13.4 |
| D-11 | Persistent cache choice (Redis vs Postgres) | Open (v2.1 AD-01) |

### 19.2 Limitations
No bank connectivity; third-party free API limits; delayed/EOD prices; taxes/fees not modeled; Firestore mode lacks price refresh; dev DB changes applied with `db push`.

### 19.3 Risks
No git history; destructive `db:reset`/force-reset scripts; floating-point legacy in non-migrated paths; build verified before later schema changes; AI provider terms/availability can change; real-sample tests skipped; unit tests mock Prisma so constraint behavior is unproven.

---

## 20. Definition of done and release checklist

### 20.1 Feature DoD
End-to-end behavior; server-side ownership; correct Decimal math; loading/empty/success/partial/error states; regression tests protecting working behavior; targeted + full tests, typecheck, lint pass (build where relevant) with recorded outputs; no secrets/PII in logs or repo; docs and progress file updated; unverified items explicit.

### 20.2 Release checklist
- [ ] Fresh clone installs and runs from README.
- [ ] Versioned migrations applied to a staging DB; backup/rollback rehearsed.
- [ ] All routes: 401/404 tests pass.
- [ ] Import suite IMP-T1–T12 green; adapters unchanged.
- [ ] Price refresh + FX behavior verified; no hard-coded rates.
- [ ] AI works with Gemini or Grok **or** degrades to deterministic output; boots without keys; PII payload test green; disclaimers visible.
- [ ] Net worth equal across dashboard/portfolio/API.
- [ ] Export and deletion verified with a test user.
- [ ] Accessibility audit (keyboard, labels, contrast, mobile tables).
- [ ] `.env.example` complete with placeholders; no secrets or private data committed.
- [ ] Recorded real command output; open limitations listed.

---

## 21. Source reconciliation and change log

### 21.1 Documents used
| Document | Role |
|---|---|
| `FinanceAI_Architecture_v2.3.md` | Primary target blueprint (schema, formulas, pipelines) — adopted selectively |
| `IMPLEMENTATION_PROGRESS.md` | Latest status evidence (newest) |
| `ARCHITECTURE_DECISIONS.md` (ADR-001–009) | Binding decisions, kept unless noted |
| `IMPLEMENTATION_PHASES.md` | Feature IDs/gates preserved; phase order superseded |
| `DATA_001_MIGRATION_PLAN.md` | Decimal plan (executed) |
| `CODEBASE_AUDIT.md` | Evidence for features; stale on schema/accounts |
| v2.2, v2.1, v2.0, `audit.md` | Historical; features/formulas/benchmarks retained where compatible |
| Consolidation prompt | Requirements for AI/asset/import specs |

### 21.2 Conflicts and resolutions
| Conflict | Resolution |
|---|---|
| MiniMax in all older docs vs expired access | Replaced with Gemini/Grok abstraction (§13) |
| v2.0 "✅ implemented" claims vs v2.1+/progress | Status from progress/test evidence |
| v2.3 `Profile` model vs ADR-009 | Deferred (D-02) |
| `/api/v1` vs `/api/*` | Keep existing (D-01) |
| v2.3 FX via Yahoo vs repo Frankfurter | Frankfurter |
| XIRR tolerance 0.0001 (v2.2) vs 1e‑6 (v2.3) | 1e‑6 with bisection |
| Health score: 0–10 (repo) / 5-pillar (v2.0) / 4-pillar (v2.3) | Open D-05 |
| ADR-006 OPEN vs DATA-006 DONE | Open; verify (P0-R04) |
| ADR-005/007 stale vs progress | Superseded by progress |
| v2.3 `dedupHash` on transactions vs no transaction import in repo | Transaction dedup is Planned (§11.7) |
| v2.3 `AssetPriceHistory`/`FXRate`/`ImportBatch` schemas | Proposals (§9.4), not implemented |
| Phase order in IMPLEMENTATION_PHASES vs required order | Replaced by §18 |
| Progress "Phase 3 NOT_STARTED" while current | Phase 3 mapping: not started |

### 21.3 Unverified items carried forward
Repository contents (not inspected); existing AI prompts/actions; Gemini/Grok provider facts; browser behavior of refresh UI; real-sample parsers; production DB behavior; exact route/page list.

### 21.4 Change log
- 2026-10-10: Consolidated into single canonical file; added Gemini/Grok architecture, manual asset CRUD, duplicate-safe import specification, unified roadmap, and explicit status/evidence policy.

*End of document.*
