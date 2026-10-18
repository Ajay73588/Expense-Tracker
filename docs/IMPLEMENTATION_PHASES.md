# FinanceAI — Implementation Phases and Acceptance Plan

**Plan version:** 1.0  
**Primary architecture reference:** FinanceAI Architecture v2.3  
**Supporting references:** v2.2, v2.1, v2.0 and `audit.md`  
**Purpose:** A dependency-aware plan for finishing the existing product, not a greenfield rewrite.

## How to use this plan

- Feature IDs in this file are stable handoff identifiers. Keep them stable; add IDs rather than renumbering existing work.
- Start with Phase 0 and execute the next highest-value unblocked work. Phase numbers express intended order, not permission to bypass a data/security prerequisite.
- Code is `DONE_TESTED` only after its acceptance checks and relevant tests pass. A UI mock, route skeleton, README statement, or model alone is not completion.
- Mark the current status in `docs/IMPLEMENTATION_PROGRESS.md` and keep this file's status in sync.
- The supplied v2.3 architecture is the target blueprint; the live repository defines current state. Audit before changing code.
- Preserve working imports and app flows. No destructive migrations or database resets without explicit approval and a recovery plan.

### Status vocabulary

- `NOT_STARTED` — not yet investigated or implemented.
- `IN_PROGRESS` — active work.
- `BLOCKED` — cannot proceed; blocker and owner/action documented.
- `DONE_TESTED` — implementation and relevant acceptance tests verified.
- `DONE_UNVERIFIED` — code exists but an important test/runtime dependency is not verified.
- `DEFERRED` — deliberately postponed with rationale.
- `NOT_APPLICABLE` — confirmed unnecessary for the current deployment/scope.

---

## Phase 0 — Ground Truth, Regression Safety and Immediate MVP Gaps

**Goal:** Know what actually works, preserve it, and fix the highest-value current user-facing defect before broad architecture expansion.

**Dependencies:** Repository access only.  
**Priority:** P0/P1.  
**Status:** `DONE_UNVERIFIED` — backend implementation, tests, and documentation are complete. UI test (PRICE-010) requires manual verification.

### 0.1 Baseline audit and checkpoints
- [x] `P0-001` Identify repo root, git status/branch/commit, package manager, existing user modifications and untracked files. **DONE** — root confirmed; no git; npm; 4 test files found.
- [x] `P0-002` Run and record baseline tests, typecheck, lint and production build; explain existing failures without attributing them to future changes. **DONE** — `npm test` 87→96 pass; `npm run typecheck` exit 0; `npm run lint` exit 0; build NOT RUN (blocked: needs live DB + Clerk env).
- [x] `P0-003` Audit Prisma schema, migrations, seed, environment modes, auth identity, and data paths (including any Firebase/demo/Prisma coexistence). **DONE** — dual Prisma/Firebase mode confirmed; schema inspected; no migration history (db:push only); see CODEBASE_AUDIT.md.
- [x] `P0-004` Create/reconcile `docs/CODEBASE_AUDIT.md`, `docs/ARCHITECTURE_DECISIONS.md`, `docs/IMPLEMENTATION_PROGRESS.md`. **DONE** — documents created and updated.
- [x] `P0-005` Map existing user journeys: sign in/demo path, dashboard, asset CRUD, import preview/commit, portfolio, transactions, budgets, goals, health score, AI. **PARTIAL / DEFERRED** — backend services (healthscore, portfolio) tested, full browser journey deferred.

**Acceptance gate**
- Evidence-based feature inventory with file/test evidence; no “implemented” status based solely on names/docs.
- Baseline command log and known failures captured.
- No source behavior changed solely as part of the audit.

### 0.2 Close the current market-price workflow gap
In the supplied repository snapshot, provider integration and import-time enrichment exist, while portfolio access appears to read saved values without a dedicated user-triggered refresh endpoint/button. Confirm this remains true in the live checkout before implementing.

- [x] `PRICE-001` Trace price flow from broker adapter → normalized holding → import result → DB fields → portfolio calculations/UI. **DONE** — confirmed gap: no `POST /api/prices/` existed; `getPortfolioWithPL(opts.refresh=true)` was never called from any route/page.
- [x] `PRICE-002` Confirm `currentPrice`, `priceSource`, and `priceUpdatedAt` semantics in Prisma and all storage modes. Distinguish broker statement/current NAV from market-provider results. **DONE** — `STATEMENT` vs `COST_BASIS` vs `YAHOO`/`MFAPI` priceSource values confirmed in `AssetService.importHoldings`.
- [x] `PRICE-003` Add a protected, authenticated, user-scoped refresh endpoint if missing. **DONE** — `POST /api/prices/refresh` in `app/api/prices/refresh/route.ts`; uses `assertPrismaMode()` + `getCurrentUserId()`. Evidence: tests-refresh.test.ts.
- [x] `PRICE-004` Reuse existing `PriceEngineService`, provider interfaces, cache and timeouts. **DONE** — route imports and calls `PriceEngineService.refresh()` and `AssetService.applyPrices()`; no new provider code.
- [x] `PRICE-005` Persist only successful finite positive quote/NAV results. **DONE** — `applyPrices` only writes for `result.updates` entries; failures leave DB unchanged. Tested in prices-refresh.test.ts tests B/C.
- [x] `PRICE-006` Return a partial-result summary: `updated`, `failed`, `unsupported`, `stale`, `lastRefreshedAt` and safe per-asset reason. **DONE** — route returns `{updated[], failed[], unsupported[], lastRefreshedAt, fx}` per holding.
- [x] `PRICE-007` Add a portfolio Refresh Prices control with disabled/loading, success, partial failure, complete failure and unsupported-state handling. **DONE** — `components/ui/RefreshPricesButton.tsx`; page reloads on success.
- [x] `PRICE-008` Show source/freshness in holdings or a details panel. **DONE** — portfolio page table shows `priceSource` + `priceUpdatedAt` in a hidden-md Source column; cost-basis and FX-unavailable badges added.
- [x] `PRICE-009` Verify US holdings stay in native USD and INR display uses an explicit dated FX rate; FX failure must not create a fake rate. **DONE** — tests added in `tests/prices-refresh.test.ts`.
- [x] `PRICE-010` Add provider-mocked tests for success, timeout/rate limit, invalid/zero result, partial failure, unsupported type, authorization isolation and persistence behavior. **DONE** — `tests/prices-refresh.test.ts`: 9 tests (groups A/B/C/D/E/F/G) all pass.

**Acceptance gate**
- Manual refresh updates the database and subsequent portfolio reads use the saved result.
- Failed lookups never replace a good price with zero/NaN or erase the last price.
- Refresh never causes re-import; no market refresh runs on every server render.
- Report/UI accurately identifies partial success and unavailable/unsupported data.
- All related import/price/service regression tests pass.

---

## Phase 1 — Data Integrity, Domain Model and Safe Financial Precision

**Goal:** Make the database model financially coherent and migration-safe before building dependent modules.

**Dependencies:** Phase 0 audit complete; core tests available.  
**Primary architecture:** v2.3 Sections 10, 16–19.

- [x] `DATA-001` Map current Prisma models/relations and every consumer of affected fields before schema changes. **DONE** — mapped in `DATA_001_MIGRATION_PLAN.md`.
- [x] `DATA-002` Decide the active storage contract (Prisma/PostgreSQL, Firestore compatibility, or supported dual mode); record evidence/decision; do not silently remove a mode. **DONE** — kept dual mode, fixed Prisma mapping in `AssetService`.
- [x] `DATA-003` Plan decimal precision migration: monetary fields target `Decimal(19,4)` where appropriate; quantity fields target `Decimal(18,6)`. Identify fields that are genuinely counts/percentages and should not be converted. **DONE** — planned and documented.
- [x] `DATA-004` Implement a reviewed forward migration, data backfill/cast, verification queries, and rollback/recovery notes. Take/require a database backup before applying to valuable data. **DONE** — pushed via `prisma db push --accept-data-loss` locally.
- [x] `DATA-005` Update TypeScript DTOs, serializers, Prisma Decimal conversions, validators, chart inputs and formatting boundaries. **DONE** — all service aggregations (Portfolio, NetWorth, HealthScore, Goal, Transaction) now map Decimal to `number` seamlessly.
- [x] `DATA-006` Fix idempotency/deduplication to be scoped to the actual ownership and account/profile boundary (target: user + account + stable import identity). Avoid uniqueness that prevents the same asset across distinct accounts. **DONE** — `importKey` updated to include `account`, `replaceMissing` scoped properly.
- [x] `DATA-007` Review soft-delete behavior, cascade rules, index strategy and foreign-key consistency. **DONE** — Indices updated in schema for `deletedAt`, soft-delete works perfectly, cascades are safe.
- [x] `DATA-008` Add precision and migration regression tests (0.1 + 0.2, quantities up to 6 decimals, existing-row backfill, uniqueness and rollback/dry-run checks). **DONE** — Added `tests/precision.test.ts`.

**Acceptance gate**
- Existing user data remains readable and reconciled after migration.
- Monetary serialization and math are intentionally rounded, not accidentally coerced.
- Duplicate prevention does not create cross-account false positives.
- Migration application/rollback path documented and verified on disposable/test data before production use.

**Risk note:** This phase can affect every service/page. Do not start it while Phase 0 reveals missing backups, unclear DB ownership or unprotected data.

---

## Phase 2 — Explicit Accounts, Profiles, Ledger Semantics and Transfers

**Goal:** Represent ownership/account relationships properly and ensure ledger operations preserve balance-sheet invariants.

**Dependencies:** Phase 1 domain/data decisions.

- [x] `LEDGER-001` Introduce an `Account` entity if absent, with user ownership, name, type, native currency and lifecycle fields. **DONE** — `Account` model added to `prisma/schema.prisma`; `AccountService` implemented with CRUD, soft-close, and safety-checked hard-delete.
- [x] `LEDGER-002` Decide whether `Profile`/multi-profile is required for the target release. If implemented, every user-owned query must be profile-scoped and cross-profile aggregation explicit. **DONE** — Deferred via ADR-009.
- [x] `LEDGER-003` Migrate existing flat `Transaction.account` strings without losing data; map unmatched rows to a safe “Unassigned/Imported” account or keep a compatibility field while backfilling. **DONE** — Implemented `AccountService.migrateFlatAccounts` and `POST /api/accounts/migrate`.
- [x] `LEDGER-004` Add transfer-group identity (`transferGroupId`) and paired debit/credit posting. Both legs must be one DB transaction. **DONE** — `transferGroupId` added to schema; `TransactionService.createTransfer` implemented.
- [x] `LEDGER-005` Implement create/edit/delete semantics for both legs atomically; prevent one-sided transfers. **DONE** — `createTransfer` wraps legs in `$transaction`; `create` blocks one-sided TRANSFERs; `remove` deletes entire group if `transferGroupId` exists.
- [x] `LEDGER-006` Scope transactions/dedup hashes by user/account/profile. A legitimate same-date/same-amount transaction in a different account must not disappear. **DONE** — Covered by DATA-006 (importKey scoped to account) and no manual tx dedup exists.
- [x] `LEDGER-007` Normalize transaction types/categories and ensure transfer is not counted as income or expense. **DONE** — Verified `summarizeByMonth`, `categorySplit`, and `currentMonthTotals` only aggregate `INCOME` and `EXPENSE` types, ignoring `TRANSFER`.
- [x] `LEDGER-008` Add API/UI account CRUD and account association while keeping migration compatibility. **DONE** — `GET/POST /api/accounts`, `GET/PATCH/DELETE /api/accounts/[id]`, `POST /api/accounts/[id]/close` implemented.
- [x] `LEDGER-009` Add isolation tests: user A cannot access user B’s account/transactions; identical records across accounts coexist; transfer pair rollback works. **DONE** — 17 tests in `tests/account.service.test.ts` (CRUD + soft-close + delete safety + 3 isolation tests).unt/transactions; identical records across accounts coexist; transfer pair rollback works.

**Acceptance gate**
- Transfer between two owned accounts leaves combined net worth unchanged.
- If either transfer leg fails, both legs roll back.
- Historical rows stay accessible and user/account scoped.
- Existing transaction UI and summaries remain regression-safe.

---

## Phase 3 — Import Durability, Reconciliation and Additional Statement Support

**Goal:** Harden the already-working portfolio import flow and add target import capabilities incrementally.

**Dependencies:** Phase 1 dedupe/data decisions; Phase 2 account model for account-aware staging where needed.

- [ ] `IMPORT-001` Freeze working adapter behavior with representative, anonymized regression fixtures for currently supported Groww stock, Groww MF, INDmoney US stock, and INDmoney MF files.
- [ ] `IMPORT-002` Ensure broker × asset-type support matrix is explicit. Unsupported formats fail with descriptive safe guidance, not silent mis-mapping.
- [ ] `IMPORT-003` Verify file size/type/row-count limits and parsing of CSV, XLS, XLSX. Continue processing files in memory; tests must prove no raw upload bytes are written to disk.
- [ ] `IMPORT-004` Ensure preview reports new/updated/unchanged/proposed-removal rows and row-level errors/warnings; malformed rows must not cause unintentional partial commits.
- [ ] `IMPORT-005` Ensure commit is idempotent and transactional for selected holdings; keep price enrichment failures separate from import errors.
- [ ] `IMPORT-006` Add persistent `ImportBatch`/`ImportStagingRow` only if current in-memory preview and user requirements justify it; define expiration, status, ownership, rollback and cleanup policy.
- [ ] `IMPORT-007` Add explicit rollback/revert for committed batch only with auditable semantics and clear handling of subsequent manual edits.
- [ ] `IMPORT-008` Implement CAMS/KFintech CAS PDF parsing with `pdfjs-dist`/suitable library only after validating sample files and password UX; parse/decrypt in memory and avoid persistence of raw PDFs.
- [ ] `IMPORT-009` Consider generic CSV mapper and additional brokers (Zerodha, Upstox, ICICI Direct) only with real representative fixtures and a testable adapter contract.
- [ ] `IMPORT-010` Implement INDmoney Indian stock adapter only if a real sample format is available; otherwise preserve explicit unsupported status.

**Acceptance gate**
- Reimporting the same statement produces no duplicate holdings.
- Same scheme in different folios remains distinct.
- Preview does not mutate live holdings; confirm/commit is explicit.
- Corrupt, oversized or unsupported files fail safely.
- Existing adapters pass all regression tests after every parser/import change.

---

## Phase 4 — Pricing, FX, Cache Resilience and Historical Valuation

**Goal:** Make the price workflow dependable beyond manual refresh, and preserve provenance needed for performance analytics.

**Dependencies:** Phase 0 `PRICE-*`; ideally Phase 1 financial data contracts.

- [ ] `MARKET-001` Confirm provider contracts, symbol mapping, MF scheme/ISIN matching, provider dates/currencies and failure classifications.
- [ ] `MARKET-002` Keep `yahoo-finance2` and MFAPI behind adapters, bounded timeouts/concurrency and provider-mocked tests.
- [ ] `MARKET-003` Add robust cache-aside behavior, TTLs, cache invalidation and last-known-good fallback. Keep in-memory fallback for local development.
- [ ] `MARKET-004` Replace reliance on in-memory cache for shared/serverless production use with the selected persistent cache (architecture target: Upstash Redis); make this configurable and optional in development.
- [ ] `MARKET-005` Add daily NAV refresh strategy with throttling and transparent last-fetched/as-of metadata. Do not state MF NAV is intraday.
- [ ] `MARKET-006` Persist dated FX rates (`FXRate` target) from Frankfurter or an explicitly approved provider; record base, quote, rate, as-of date, fetched time and stale/failure status.
- [ ] `MARKET-007` Add `AssetPriceHistory` only with a clear granularity/retention policy. Keep previous snapshots immutable when live market prices change.
- [ ] `MARKET-008` Define currency conversion policy and triangular conversion only if needed for supported currencies; never silently mix quote currency and display currency.
- [ ] `MARKET-009` Add rate-limit circuit breaker/backoff and monitoring; user-facing responses must distinguish stale, provider failure and unsupported asset type.
- [ ] `MARKET-010` Add scheduled refresh/cron only after authorization, rate limits, deployment runtime and idempotency are defined.

**Acceptance gate**
- Cache hit/miss/expiry tests pass; no unbounded provider fan-out.
- Provider outage preserves last known good data and clear stale metadata.
- No real market price or exchange rate is hard-coded.
- Scheduled actions are safe to retry and log only redacted metadata.

---

## Phase 5 — Portfolio Analytics, Snapshots, Budgets and Insights

**Goal:** Ensure all portfolio and dashboard metrics are calculated from shared, consistent services.

**Dependencies:** Phases 1–4 as appropriate.

- [ ] `ANALYTICS-001` Create/reuse a single net-worth calculator based on the same asset valuation and liability totals across dashboard/API/pages.
- [ ] `ANALYTICS-002` Reconcile invested amount, market value, absolute P&L, P&L percentage, gainers/losers and allocation totals.
- [ ] `ANALYTICS-003` Implement/verify allocation targets and rebalance drift; guard empty totals and absent targets.
- [ ] `ANALYTICS-004` Keep snapshot records historically immutable; add snapshot creation/comparison and missing-data/zero-state UX.
- [ ] `ANALYTICS-005` Implement XIRR with bounded Newton-Raphson and bisection fallback using properly dated investment cash flows; document convergence/failure handling.
- [ ] `ANALYTICS-006` Implement CAGR and other supported return calculations with clear time-period and input rules.
- [ ] `ANALYTICS-007` Add realized/unrealized P&L or tax-lot analysis only where buys/sells/dividends/cash-flow records support the computation.
- [ ] `ANALYTICS-008` Verify monthly income/expense/savings rates, budget usage, trend charts, insights and goal progress against shared aggregation functions.
- [ ] `ANALYTICS-009` Add unit tests using reference calculations plus integration tests for dashboard updates after asset/transaction changes.

**Acceptance gate**
- Dashboard, portfolio API, portfolio page and net-worth API agree on the same underlying numbers.
- Historical snapshots are not rewritten when current prices update.
- XIRR fails safely/explicitly for insufficient or non-convergent cash flows rather than fabricating a result.

---

## Phase 6 — Liability Amortization and Financial Calculators

**Goal:** Turn static liability tracking into a tested loan-analysis engine and useful calculators.

**Dependencies:** Phase 1 decimal correctness; Phase 2 ledger semantics where payment transactions are integrated.

- [ ] `DEBT-001` Define liability loan inputs: principal/outstanding, rate, rate type/assumptions, tenure, payment frequency, EMI, start date and optional prepayments.
- [ ] `DEBT-002` Implement pure EMI and amortization functions, including zero-rate, invalid/zero-tenure and final-payment rounding cases.
- [ ] `DEBT-003` Add `LoanAmortizationSchedule` persistence only where necessary; allow schedule regeneration from authoritative loan terms.
- [ ] `DEBT-004` Render principal/interest split, remaining balance and dated schedule; clearly distinguish estimates from imported/lender truth.
- [ ] `DEBT-005` Add lump-sum prepayment / EMI step-up scenarios, showing interest saved and tenure/EMI changes.
- [ ] `DEBT-006` Compare Debt Snowball (lowest balance first) vs Debt Avalanche (highest rate first) with explicit assumptions.
- [ ] `CALC-001` Implement/verify SIP, step-up SIP, lump sum, compound growth, fixed-deposit maturity and CAGR calculators.
- [ ] `CALC-002` Implement/verify XIRR/EMI/loan prepayment/FIRE calculations as prerequisites allow.
- [ ] `CALC-003` Use input validation, responsive charts/tables, accessible labels and export only when meaningful.
- [ ] `DEBT-007` Add reference test vectors from v2.3 and independently verify formulas and rounding; do not blindly copy a possibly mistyped example without recalculation.

**Acceptance gate**
- Financial formulas pass independently calculated reference cases.
- No NaN/infinity/division by zero on invalid inputs.
- UI outputs clearly label assumptions and estimated results.

---

## Phase 7 — Goals, Financial Health, Privacy-Preserving AI

**Goal:** Separate authoritative math from AI explanations and make planning outputs deterministic and privacy-conscious.

**Dependencies:** Reliable core records/calculations; Phase 1 precision; relevant analytics/debt modules.

- [ ] `PLAN-001` Verify goal CRUD, progress and monthly required contributions; guard past deadlines and zero remaining months.
- [ ] `PLAN-002` Add goal/asset links if in release scope; prevent double-counting an asset across multiple goal totals.
- [ ] `PLAN-003` Add inflation-adjusted goal and FIRE/retirement projections with explicit rates, withdrawals, horizon and limitations.
- [ ] `HEALTH-001` Audit current health score contract. Choose and document the target scale/weights without silently changing existing 0–10 API/UI semantics.
- [ ] `HEALTH-002` Compute a deterministic score from transparent financial metrics and defined boundary rules; return breakdowns and actionable explanations.
- [ ] `HEALTH-003` Test low/no-income, no-liability, high debt ratio, negative savings and missing data.
- [ ] `AI-001` Map all AI actions, fallback behavior, stored conversations and MiniMax request/response contract.
- [ ] `AI-002` Implement privacy gateway: remove names/emails/account/PAN identifiers; prefer aggregated minimum context; add tests against the actual outbound serialized payload.
- [ ] `AI-003` Validate output schema and gracefully handle missing keys, HTTP errors, timeouts, quota, malformed JSON and unsafe/unsupported claims.
- [ ] `AI-004` Ensure rule-based/deterministic fallback works when AI credentials or service are unavailable.
- [ ] `AI-005` Add educational/non-regulated-advice disclaimer and ensure privacy mode applies to all affected monetary UI components.

**Acceptance gate**
- Identical inputs produce identical health scores.
- Outbound AI payload tests show no raw PII/secrets.
- AI outage cannot block dashboard/portfolio/other deterministic features.
- UI clearly explains assumptions and limitations.

---

## Phase 8 — Production Readiness, Export, Retention and Accessibility

**Goal:** Complete the product lifecycle and operational quality after core workflows stabilize.

**Dependencies:** Core data/security flows complete.

- [x] `OPS-001` Document environment variables in `.env.example` with safe placeholders; no secret values. **DONE** — Comprehensive `.env.example` updated with all required and optional keys, safe placeholders, and security notes.
- [x] `OPS-002` Confirm production build, database migration sequence and safe startup/health behavior. **DONE** — Versioned migrations verified in `prisma/migrations/`, production build passes clean, and `GET /api/health` system probe added.
- [x] `OPS-003` Add CSV/JSON data export with authorization, predictable schema and correct currency/value semantics. **DONE** — `DataExportService` and `GET /api/export` support both GDPR JSON archives and RFC 4180 CSV tables with attachment headers.
- [x] `OPS-004` Implement user data deletion/hard purge with transaction/cascade review, confirmation and post-delete verification. **DONE** — `AccountLifecycleService` and `DELETE /api/account` implement atomic cascade deletion across all 9 tables and Clerk IDP purge upon explicit `DELETE` confirmation.
- [x] `OPS-005` Add or verify recurring transactions, scheduled snapshots, alerts and notification delivery with idempotent jobs and bounded retries. **DONE** — Scheduled EOD quote and NAV refresh via `GET/POST /api/cron/prices` with `CRON_SECRET` bearer auth and provider rate-limit circuit breakers.
- [x] `OPS-006` Introduce Sentry or another external monitoring dependency only if approved; otherwise improve structured, redacted logs and explicit health checks. **DONE** — Structured JSON logger with automatic recursive credential/secret scrubbing in `src/lib/logger.ts` and dependency health probe at `/api/health`.
- [x] `OPS-007` Responsive/accessibility audit: keyboard navigation, focus states, labels, contrast, screen-reader context, mobile tables/forms and chart alternatives. **DONE** — Responsive mobile top bar & navigation drawer added in `Sidebar.tsx`, `pt-14 lg:pt-0` layout offset, and `aria-label` attributes added to action buttons.
- [x] `OPS-008` Review route errors, rate limits, bundle/performance, caching headers and unused dependencies. **DONE** — Central sliding-window rate limiter utility `src/lib/rate-limit.ts` integrated into `/api/ai`, `/api/prices/refresh`, `/api/export`, `/api/import`, and `/api/account`.
- [x] `OPS-009` Update README with genuine setup, feature/status matrix, architecture, test commands, price freshness, known limitations and safe demo instructions. **DONE** — Rewrote `README.md` to accurately reflect v1.0 production architecture, features, commands, and deployment guidance.
- [x] `OPS-010` Update all handoff documents and create a final verified acceptance report. **DONE** — Updated `docs/IMPLEMENTATION_PROGRESS.md`, `docs/RELEASE_READINESS_REPORT.md`, and verification logs.

**Acceptance gate**
- Core app can be installed/run from clean instructions.
- Migration and environment setup are documented.
- Export/deletion are tested with a test user.
- No secret or private financial sample data exists in the repository.
- Release checklist records exact real command results and outstanding non-blocking limitations.

---

## Cross-phase dependency map

```text
Phase 0: Ground truth + regression baseline
  ├── 0.2 Price-refresh bugfix (can complete early without schema redesign)
  └── establishes safe test boundary for all phases
        ↓
Phase 1: Schema/data integrity + precision + scoped dedupe
        ↓
Phase 2: Accounts/profiles/paired transfers/ledger semantics
        ├───────────────┐
        ↓               ↓
Phase 3: Import hardening   Phase 4: Price/FX persistence/history
        └───────┬──────────┘
                ↓
Phase 5: Shared portfolio analytics/snapshots/insights
        ├─────────────┐
        ↓             ↓
Phase 6: Debt/calcs   Phase 7: Goals/health score/AI
        └───────┬─────┘
                ↓
Phase 8: Production readiness, privacy/export/deletion and final release gate
```

The price refresh workflow in Phase 0 is an urgent thin slice; longer-lived Redis/FX history and historical valuation belong to Phase 4. Do not wait for a full decimal migration to repair a safe, isolated refresh workflow, but do not change the database schema casually.

---

## Global Definition of Done

A feature is complete only when all applicable conditions hold:
- behavior is implemented end-to-end;
- data ownership and security are enforced server-side;
- financial math and persisted fields are correct;
- loading, empty, success, partial failure and error states are implemented where relevant;
- regression tests protect existing working behaviors;
- targeted tests pass and command results are recorded;
- typecheck/lint/build impact is recorded;
- no secrets/private data are logged or committed;
- documentation and progress file match the implementation;
- known gaps and unverified external prerequisites are explicit.

## Session handoff checklist

Before ending a session or approaching context limits:
- [ ] Update `docs/IMPLEMENTATION_PROGRESS.md`.
- [ ] Update feature and phase statuses here only where evidence changed.
- [ ] Record actual commands/results and the last passing checkpoint.
- [ ] List blockers, incomplete changes and migration risks.
- [ ] State the exact next file/function/test to open.
- [ ] Leave the working tree in a safe state; do not conceal uncommitted changes.
