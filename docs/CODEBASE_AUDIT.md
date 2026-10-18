# FinanceAI — Codebase Audit

> **Created:** 2026-10-10  
> **Last updated:** 2026-10-10 14:25 IST  
> **Status vocabulary:** `VERIFIED` (code + test evidence), `PARTIAL` (code exists, tests missing or incomplete), `MISSING` (gap confirmed), `BROKEN` (runtime/test failure), `BLOCKED` (cannot verify without live env), `DEFERRED` (lower priority, deliberately postponed)

This document records facts found in the live checkout. Architecture documents describe targets; only code and test evidence establish current status. Update rather than delete entries when status changes.

---

## 1. Repository overview

| Item | Value |
|---|---|
| Root | `Expense-Tracker-main/` |
| Framework | Next.js 14.2.25 / React 18 / TypeScript 5.5 |
| Package manager | npm (package-lock.json present) |
| Database | PostgreSQL via Prisma 5.22 (default); Firestore via firebase-admin 13 (legacy, `USE_FIREBASE=true`) |
| Auth | Clerk (`@clerk/nextjs` ^6.11) |
| Styling | Tailwind 3.4 + tailwind-merge |
| Charts | Recharts 2.12 |
| Testing | Vitest 2.1 |
| Git | **Not a git repository** (ZIP extract — no `.git` present) |
| Build scripts | `dev`, `build`, `start`, `lint`, `test`, `typecheck`, `db:push`, `db:seed`, `db:reset`, `db:migrate` |

---

## 2. Schema (Prisma / PostgreSQL)

File: `prisma/schema.prisma`

| Model | Key fields | Notes |
|---|---|---|
| `User` | `id`, `clerkId`, `email`, `name`, `currency`, `privacyMode` | Upserted by auth.ts on first login; index on email |
| `Asset` | `id`, `userId`, `type`, `name`, `symbol`, `quantity`, `avgBuyPrice`, `currentPrice`, `currency`, `account`, `importSource`, `isin`, `exchange`, `folio`, `importKey`, `priceSource`, `priceUpdatedAt`, `deletedAt` | `Float` (not Decimal) for monetary fields — precision gap noted for Phase 1 |
| `Transaction` | `id`, `userId`, `type`, `amount`, `category`, `description`, `date`, `account`, `tags` | `tags` stored as JSON string |
| `Liability` | `id`, `userId`, `type`, `name`, `principalAmount`, `outstandingAmount`, `interestRate`, `monthlyEMI`, `dueDate` | All amounts are `Float` |
| `Goal` | `id`, `userId`, `name`, `targetAmount`, `currentAmount`, `targetDate`, `monthlyRequired`, `status` | All amounts `Float` |
| `Budget` | `id`, `userId`, `category`, `monthlyLimit`, `month`, `year` | Unique on `(userId, category, month, year)` |
| `Snapshot` | `id`, `userId`, `date`, `totalAssets`, `totalLiabilities`, `netWorth`, `breakdown` | `breakdown` is JSON string; unique on `(userId, date)` |
| `AllocationTarget` | `id`, `userId`, `assetType`, `targetPercent` | Unique on `(userId, assetType)` |
| `AIConversation` | `id`, `userId`, `action`, `messages`, `contextSnapshot` | `messages` is JSON string |

**Key schema observations:**
- No versioned migrations — uses `prisma db push` only. Schema changes are applied directly, no rollback path.
- All monetary fields are `Float` (JS `number`). Phase 1 target is `Decimal(19,4)` for money, `Decimal(18,6)` for quantity. **Do not migrate before auditing all consumers.**
- `Asset.importKey` has a `@@unique([userId, importKey])` constraint — same holding in different accounts cannot be distinguished (identified in ADR-006).
- `Transaction.tags` is a JSON string — not indexed or typed as array.
- No `Account` entity — account is a plain string field. Phase 2 target adds an explicit Account model.

---

## 3. Auth and user isolation

File: `src/lib/auth.ts`

| Item | Status | Evidence |
|---|---|---|
| Clerk auth integration | `PARTIAL` | Uses `auth()` + `currentUser()` from `@clerk/nextjs/server`; upserts User in Prisma |
| User scoping in services | `PARTIAL` | All Prisma queries in services use `where: { userId }` — inspected in asset, import, portfolio, networth, transaction, budget, goal services |
| Demo/development path | `BLOCKED` | No explicit demo mode found in auth.ts; Clerk throws "Unauthorized" if not logged in. Demo path may be handled by middleware or feature env — middleware.ts is minimal (2 lines) |
| Firebase user path | `PARTIAL` | Firebase user is looked up by `clerkId`; fallback creates a new Firestore document |

---

## 4. Feature inventory

### 4.1 Import pipeline

| Capability | Status | Evidence path | Notes |
|---|---|---|---|
| Groww Indian stock (IN_STOCK) CSV/XLSX | `VERIFIED` | `src/adapters/groww-stock.adapter.ts`; `tests/adapters.test.ts` Group A | ISIN identity; statement price; 2-row fixture passes |
| Groww mutual fund CSV/XLSX | `VERIFIED` | `src/adapters/groww-mutualfund.adapter.ts`; `tests/adapters.test.ts` Group B | Folio-scoped identity; derived avg price; reconciliation check |
| INDmoney US stocks XLS/XLSX | `VERIFIED` | `src/adapters/indmoney-usstock.adapter.ts`; `tests/adapters.test.ts` Group C | Legacy `.xls` (BIFF8); fractional qty; USD preserved |
| INDmoney mutual fund CSV/XLSX | `VERIFIED` | `src/adapters/indmoney-mutualfund.adapter.ts`; `tests/adapters.test.ts` Group D | ISIN+folio identity; derived avg price |
| INDmoney Indian stocks (IN_STOCK) | `DEFERRED` | `src/adapters/registry.ts` — explicitly unsupported | Returns "PDF depository statement" message; correct behavior |
| File-size / row-count limits | `VERIFIED` | `src/adapters/sheet-reader.ts` — 5 MB max, 5000 rows; `tests/adapters.test.ts` Group E | Tested with too-large and too-many-rows cases |
| Preview (dry-run, writes nothing) | `VERIFIED` | `ImportService.preview()`; `tests/import-flow.test.ts` | Plan computed without DB writes |
| Commit (idempotent on importKey) | `VERIFIED` | `AssetService.importHoldings()`; `tests/import-flow.test.ts` Group H | Re-import is a no-op; quantity not doubled |
| replaceMissing / soft-delete | `VERIFIED` | `tests/import-flow.test.ts` Group H | Missing holdings soft-deleted; revived on re-import |
| File in memory (no disk write) | `VERIFIED` | `app/api/import/route.ts` uses `file.arrayBuffer()` — bytes never written to disk | |
| Unsupported format error handling | `VERIFIED` | `tests/adapters.test.ts` Group E, F | PDF, no-ext, wrong-broker hints all tested |
| Duplicate row within one file | `VERIFIED` | `tests/adapters.test.ts` Group H | Second occurrence rejected, not merged |

### 4.2 Price engine

| Capability | Status | Evidence path | Notes |
|---|---|---|---|
| Yahoo Finance provider (stocks) | `VERIFIED` | `src/services/market/yahoo.provider.ts`; `tests/services.test.ts` (Yahoo provider section) | US + Indian (NSE/BSE); ISIN → ticker via search; batched; timeout; rate-limit classified |
| MFAPI provider (mutual funds) | `VERIFIED` | `src/services/market/mfapi.provider.ts`; `tests/services.test.ts` (mfapi section) | Name + ISIN matching; ambiguous scheme refused; statement NAV used to disambiguate |
| Cache (in-memory TTL) | `VERIFIED` | `src/lib/cache.ts`; `tests/services.test.ts` Group L | Cache hit avoids second provider call; failed results NOT cached |
| Batch deduplication | `VERIFIED` | `tests/services.test.ts` | Same ticker in two rows → one provider call |
| Partial failure | `VERIFIED` | `tests/services.test.ts` | One bad ticker does not fail others |
| Unsupported types (CRYPTO/REAL_ESTATE/CASH) | `VERIFIED` | `tests/services.test.ts` | Returned in `unsupported[]`, no invented price |
| Provider timeout | `VERIFIED` | `tests/services.test.ts` Yahoo timeout test | Classified as TIMEOUT, not thrown |
| **Manual price refresh endpoint** | `VERIFIED` | `app/api/prices/refresh/route.ts`; `tests/prices-refresh.test.ts` | **NEW in session 1** — 9 tests pass |
| Persist prices (applyPrices) | `VERIFIED` | `src/services/asset.service.ts#applyPrices`; `tests/prices-refresh.test.ts` Groups A/B/C | Only successful results written; failures leave DB unchanged |
| Refresh UI button | `PARTIAL` | `components/ui/RefreshPricesButton.tsx` | Client component; all states coded; browser test NOT done |
| Price source/freshness display | `PARTIAL` | `app/(dashboard)/portfolio/page.tsx` | Table shows priceSource + priceUpdatedAt; hidden on mobile; not browser-tested |
| Auto-refresh on render | `MISSING (intentional)` | Confirmed: `app/api/portfolio/route.ts` does not trigger refresh | Correct — refresh is explicit only |
| Redis / persistent cache | `MISSING` | Only in-memory cache (`src/lib/cache.ts`) | Phase 4 target; acceptable for development |
| Scheduled refresh/cron | `MISSING` | Not implemented | Phase 4 target |

### 4.3 FX rate service

| Capability | Status | Evidence path | Notes |
|---|---|---|---|
| Frankfurter provider | `VERIFIED` | `src/services/fx/fx.provider.ts`; `tests/services.test.ts` Group I | Parses rates.INR; zero-rate throws; HTTP 429/500 throws |
| Single-flight / cache | `VERIFIED` | `tests/services.test.ts` | 100 concurrent callers share one request |
| Last-known-good stale fallback | `VERIFIED` | `tests/services.test.ts` | Provider down but cached rate → stale:true |
| No hard-coded FX rate | `VERIFIED` | `tests/services.test.ts` | Provider down + no cache → FxUnavailableError (never fabricated) |
| INR needs no FX call | `VERIFIED` | `tests/services.test.ts` | rateToInr("INR") returns 1 with zero calls |
| USD FX in portfolio P&L | `VERIFIED` | `src/services/asset.service.ts#toPL`; `tests/services.test.ts` Group J | US stock value uses FX rate; FX_UNAVAILABLE flagged if rate missing |
| USD FX in import report | `VERIFIED` | `src/services/import.service.ts#commit`; `tests/import-flow.test.ts` | FX fetched after commit for USD holdings |
| USD FX in refresh endpoint | `PARTIAL` | `app/api/prices/refresh/route.ts` — fetches FX if any asset.currency=USD | Combined test not written; FxRateService tested standalone; PRICE-009 open |

### 4.4 Portfolio and dashboard

| Capability | Status | Evidence path | Notes |
|---|---|---|---|
| Portfolio allocation by type | `PARTIAL` | `src/services/portfolio.service.ts#getAllocation` | Code reviewed; no unit tests for PortfolioService |
| Risk score (0–10) | `PARTIAL` | `src/services/portfolio.service.ts#getRiskScore` | Weighted by asset type; no tests |
| Portfolio summary (invested, P&L, top gainers/losers) | `PARTIAL` | `src/services/portfolio.service.ts#getPortfolioSummary` | No tests |
| Rebalance plan | `PARTIAL` | `src/services/portfolio.service.ts#getRebalancePlan` | Dual Firebase/Prisma; no tests |
| Net worth (assets − liabilities) | `PARTIAL` | `src/services/networth.service.ts` | Dual Firebase/Prisma; complex but no unit tests |
| Allocation targets CRUD | `PARTIAL` | `src/services/portfolio.service.ts#getAllocationTargets` | No tests |
| Snapshots | `PARTIAL` | `src/services/networth.service.ts` | Saves/retrieves snapshots; no immutability tests |
| Dashboard aggregation | `PARTIAL` | `src/services/dashboard.service.ts` | Thin wrapper; no tests |

### 4.5 Transactions

| Capability | Status | Evidence path | Notes |
|---|---|---|---|
| CRUD (create/read/update/delete) | `PARTIAL` | `src/services/transaction.service.ts` | Code exists; no unit tests |
| Monthly/category summaries | `PARTIAL` | Transaction service has aggregation methods | No tests |
| Budget tracking | `PARTIAL` | `src/services/budget.service.ts` | Limit vs spend comparison; no tests |
| Transfer support | `MISSING` | No `transferGroupId`, no paired entries | Phase 2 target |
| Account entity | `MISSING` | Account is a plain string field on Transaction | Phase 2 target |

### 4.6 Goals, health score and AI

| Capability | Status | Evidence path | Notes |
|---|---|---|---|
| Goal CRUD | `PARTIAL` | `src/services/goal.service.ts` | No tests |
| Goal progress / monthly required | `PARTIAL` | goal.service.ts calculates monthsLeft, monthlyRequired | No boundary tests (past deadline, zero months) |
| Health score (0–10 scale) | `PARTIAL` | `src/services/healthscore.service.ts` | Uses 5 dimensions; no tests |
| Insights generation | `PARTIAL` | `src/services/insights.service.ts` | Rule-based; no tests |
| AI chat (MiniMax) | `PARTIAL` | `src/services/ai/` directory | No PII-gateway test; no payload redaction |
| AI disclaimer | `BLOCKED` | Not inspected in detail | Phase 7 item |

---

## 5. API routes inventory

| Route | Method(s) | Status | Notes |
|---|---|---|---|
| `app/api/assets/` | GET, POST, PUT, DELETE | `PARTIAL` | Exists; auth-scoped; not fully tested |
| `app/api/portfolio/` | GET | `PARTIAL` | Returns allocation/summary/assets; no refresh |
| `app/api/import/` | GET, POST | `VERIFIED` | Support matrix + file upload; tested |
| `app/api/prices/refresh/` | **POST** | `VERIFIED` | **NEW — session 1**; tested; auth-scoped |
| `app/api/transactions/` | GET, POST, etc. | `PARTIAL` | Exists; not tested |
| `app/api/budget/` | GET, POST, PUT, DELETE | `PARTIAL` | Exists; not tested |
| `app/api/goals/` | GET, POST, etc. | `PARTIAL` | Exists; not tested |
| `app/api/dashboard/` | GET | `PARTIAL` | Aggregates dashboard data; not tested |
| `app/api/net-worth/` | GET | `PARTIAL` | Not tested |
| `app/api/health-score/` | GET | `PARTIAL` | Not tested |
| `app/api/insights/` | GET | `PARTIAL` | Not tested |
| `app/api/ai/` | POST | `PARTIAL` | MiniMax integration; no PII test |

---

## 6. Test coverage summary

| Test file | Tests | Status | What is covered |
|---|---|---|---|
| `tests/adapters.test.ts` | 34 | `PASS` | All 4 broker adapters, invalid files, duplicate rows, CSV support |
| `tests/import-flow.test.ts` | 18 | `PASS` | Preview/commit, idempotency, scope isolation, provider failures, FX |
| `tests/services.test.ts` | 35 | `PASS` | FxRateService, PriceEngineService, Yahoo provider, MFAPI provider, toPL, Firebase gate |
| `tests/prices-refresh.test.ts` | 9 | `PASS` | Price refresh endpoint logic: success, persistence, failure-no-overwrite, partial, unsupported, empty, isolation, mixed |
| `tests/real-samples.test.ts` | 5 | `SKIPPED` | Real broker file samples (not committed to repo) |

**Not tested at all:** dashboard.service, portfolio.service, networth.service, transaction.service, budget.service, goal.service, healthscore.service, insights.service, AI services.

---

## 7. Security review (current state)

| Item | Status | Notes |
|---|---|---|
| User isolation in services | `PARTIAL` | All Prisma queries use `userId` in `where`; Firebase queries use `.where("userId", "==", userId)` |
| Unauthenticated access | `PARTIAL` | `getCurrentUserId()` throws "Unauthorized" if no Clerk session; not regression-tested |
| No raw file bytes written to disk | `VERIFIED` | `app/api/import/route.ts` — only `file.arrayBuffer()` in memory |
| Error message sanitization | `PARTIAL` | `handleError()` in `src/lib/api.ts` maps AppError; raw provider errors may leak through |
| AI payload PII minimization | `MISSING` | No dedicated PII gateway in AI services |
| Rate limiting | `MISSING` | No rate limiting on sensitive endpoints |
| No secrets in code | `VERIFIED` | Confirmed by inspection of all new files |

---

## 8. Known gaps relative to v2.3 architecture target

| Gap | Priority | Phase |
|---|---|---|
| All monetary fields are `Float` (should be `Decimal(19,4)`) | P2 | Phase 1 |
| No explicit `Account` model (account is a plain string) | P2 | Phase 2 |
| No paired transfer entries (`transferGroupId`) | P2 | Phase 2 |
| No `ImportBatch` / `ImportStagingRow` persistence | P3 | Phase 3 |
| No CAMS/KFintech CAS PDF import | P3 | Phase 3 |
| No persistent `FXRate` history | P2 | Phase 4 |
| No `AssetPriceHistory` | P2 | Phase 4 |
| No Upstash Redis / shared cache | P2 | Phase 4 |
| XIRR not implemented | P2 | Phase 5 |
| No loan amortization engine | P2 | Phase 6 |
| No AI PII gateway / payload tests | P2 | Phase 7 |
| Health score not deterministically tested | P2 | Phase 7 |
| No CSV/JSON data export | P2 | Phase 8 |
| No user data deletion / hard-purge | P2 | Phase 8 |
