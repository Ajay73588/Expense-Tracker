# FinanceAI — Architecture Decisions

> **Format:** ADR-NNN | Decision | Evidence | Direction | Alternatives and Risks | Date  
> **Rule:** Append new decisions; never delete or overwrite prior ones. Mark superseded decisions with a note linking to the superseding ADR. No credential values here.

---

## ADR-001 — Dedicated price-refresh endpoint: `/api/prices/refresh`

**Decision date:** 2026-10-10  
**Status:** ACTIVE

**Context:**  
No `POST /api/prices/refresh` route existed. `AssetService.getPortfolioWithPL(userId, {refresh:true})` had an opt-in refresh path but no callers used it. The portfolio page is a Server Component and does not send mutations. The v2.3 architecture specifies a dedicated refresh endpoint.

**Evidence inspected:**
- `app/api/portfolio/route.ts` — GET only; no refresh logic
- `app/(dashboard)/portfolio/page.tsx` — Server Component; no client mutation
- `src/services/asset.service.ts#getPortfolioWithPL` — `opts.refresh` parameter exists, never called with `true`

**Decision:**  
Created `POST /api/prices/refresh` at `app/api/prices/refresh/route.ts`. This is distinct from the portfolio read endpoint. Refresh is intentional and user-triggered, not automatic on render.

**Rationale:** A dedicated endpoint is testable, rate-limitable, and cannot be accidentally triggered by a GET request. Separation of read and write paths matches CQRS and v2.3 contract.

**Alternatives rejected:**
- Add `?refresh=true` to `GET /api/portfolio` — would trigger on every render if front-end code changed; hard to rate-limit.
- Call `getPortfolioWithPL(userId, {refresh:true})` inline in Server Component — blocks page render on external APIs; untestable without live providers.

**Risks:** If the portfolio page is cached by Next.js, users may not see updated prices until page reload. Mitigated by `window.location.reload()` after successful refresh in `RefreshPricesButton`.

---

## ADR-002 — Price refresh is Prisma-only (Firebase mode returns 501)

**Decision date:** 2026-10-10  
**Status:** ACTIVE

**Context:**  
The app has a dual-mode runtime: Prisma/PostgreSQL (default) and Firestore (USE_FIREBASE=true). `assertPrismaMode()` in `src/lib/feature-gate.ts` returns a 501 if Firestore mode is active. Import, portfolio import, and price features all call this guard.

**Evidence inspected:**
- `src/lib/feature-gate.ts`
- `src/lib/errors/index.ts` — AppError(501)
- `tests/services.test.ts` "Firebase gate" test

**Decision:**  
Price refresh endpoint calls `assertPrismaMode()` and returns 501 if `USE_FIREBASE=true`. A Firestore implementation of price refresh is deferred.

**Rationale:** Firestore schema for assets is different from Prisma schema. Implementing two parallel paths would risk divergence. The Prisma path is the development target per v2.3.

**Risks:** Users on Firebase mode cannot refresh prices. Acceptable for development; requires implementation before Firebase production rollout.

---

## ADR-003 — Provider failures must never overwrite a last-known-good price

**Decision date:** 2026-10-10  
**Status:** ACTIVE

**Context:**  
`PriceEngineService.refresh()` returns a `{updates: Map, failures: Map, unsupported: []}` struct. `AssetService.applyPrices()` only writes for entries in `updates`. The question was whether to clear or reset the price field on failure.

**Evidence inspected:**
- `src/services/asset.service.ts#applyPrices` — only updates rows whose IDs appear in `result.updates`
- `tests/prices-refresh.test.ts` Group B — confirmed `currentPrice` stays at 999 when provider fails

**Decision:**  
Failures leave `currentPrice`, `priceSource`, and `priceUpdatedAt` unchanged. The last-known-good price is preserved. Failed assets are reported in the response `failed[]` array with reason codes.

**Rationale:** A stale price with known provenance is less harmful than a blank or zero price. Users can see the source and date and judge staleness. Aligns with v2.3 "valuationStatus" design.

**Alternatives rejected:**
- Set `currentPrice = null` on failure — would break portfolio P&L calculations for all failed assets simultaneously.
- Set `priceSource = "STALE"` — would require a schema change and doesn't add more information than the existing `priceUpdatedAt` timestamp.

---

## ADR-004 — Pre-filter unsupported types before calling PriceEngineService

**Decision date:** 2026-10-10  
**Status:** ACTIVE

**Context:**  
Asset types CRYPTO, REAL_ESTATE, and CASH are not priceable by Yahoo or MFAPI. `PriceEngineService.refresh()` does handle CRYPTO as "unsupported" internally (returns ID in `result.unsupported[]`). The question was whether to pre-filter or pass all types.

**Evidence inspected:**
- `src/services/price-engine.service.ts` — CRYPTO returned as unsupported; REAL_ESTATE/CASH also unsupported
- `tests/prices-refresh.test.ts` Group D — pre-filtering verified

**Decision:**  
In `POST /api/prices/refresh`, assets of type STOCK and MUTUAL_FUND are passed to `PriceEngineService.refresh()`. All others are tracked separately as `unsupportedIds` and reported as `unsupported_other` in the response.

**Rationale:** Pre-filtering avoids unnecessary type-routing logic inside PriceEngineService. REAL_ESTATE and CASH are clearly not market-data lookups. Response reports all non-priceable assets to the client.

**Alternatives:** Could pass all types to PriceEngineService and let it classify internally — this would centralize logic but couple the engine to the endpoint's asset type list.

---

## ADR-005 — Monetary fields remain `Float` until Phase 1 (DATA-001)

**Decision date:** 2026-10-10  
**Status:** ACTIVE — pending Phase 1

**Context:**  
All monetary fields in `prisma/schema.prisma` use `Float` (JavaScript `number`). The v2.3 target specifies `Decimal(19,4)` for monetary amounts and `Decimal(18,6)` for quantities to avoid floating-point errors in P&L calculations.

**Evidence inspected:**
- `prisma/schema.prisma` — all Asset, Liability, Goal, Snapshot amounts are `Float`
- `src/services/asset.service.ts#toPL` — arithmetic uses plain `number`
- No `prisma.js` `$extends` or custom decimal middleware found

**Decision:**  
Do NOT migrate to Decimal in Phase 0. Any migration requires: (1) auditing all consuming services and UI types, (2) a backfill plan, (3) a disposable test database, (4) a rollback procedure. This work is scoped to Phase 1 (`DATA-001`).

**Risk:** P&L calculations involving large quantities or small prices may accumulate floating-point error. For typical portfolio sizes this is unlikely to matter, but it remains a correctness risk. Add a regression test in Phase 1 before migration.

---

## ADR-006 — `importKey` uniqueness constraint prevents multi-account same holding

**Decision date:** 2026-10-10  
**Status:** OPEN — resolution deferred to Phase 3

**Context:**  
`Asset` model has `@@unique([userId, importKey])`. The `importKey` format is `"BROKER|ASSET_CLASS|ISIN"` for mutual funds and `"BROKER|ASSET_CLASS|SYMBOL"` for stocks. A user holding the same stock in two different accounts (e.g., joint + individual) would cause a uniqueness violation on re-import.

**Evidence inspected:**
- `prisma/schema.prisma` — `@@unique([userId, importKey])`
- `src/adapters/groww-stock.adapter.ts` — importKey = `"GROWW|IN_STOCK|${isin}"`
- `src/adapters/indmoney-usstock.adapter.ts` — importKey = `"INDMONEY|US_STOCK|${symbol}"`
- No `accountId` component in importKey

**Decision:**  
Leave importKey as-is for Phase 0/1. In Phase 3 (`IMPORT-001`), include broker account ID in the importKey (requires schema change and migration). In the interim, document that multi-account same-holding is not supported.

**Alternatives:**
- Add account field to importKey now — would invalidate all existing importKeys (data migration required)
- Remove uniqueness constraint — would allow duplicate imports without detection
- Use `(broker, assetClass, ISIN/symbol, account)` composite key — Phase 3 target

---

## ADR-007 — `npm run build` not run; deferred until live env available

**Decision date:** 2026-10-10  
**Status:** BLOCKED — needs `DATABASE_URL` + `CLERK_SECRET_KEY`

**Context:**  
`npm run build` requires a valid `DATABASE_URL` (for Prisma client generation and optional schema introspection at build time) and Clerk keys (Next.js App Router validates server-side Clerk calls during build). Running build without these variables would produce misleading errors.

**Decision:**  
Build verification is deferred to Phase 8 (`OPS-001`) when a real environment is available. All file-level type safety is confirmed via `npm run typecheck` (passes). Runtime correctness is confirmed via tests.

**Risk:** Build-time optimizations or Next.js RSC compilation may reveal errors not caught by `tsc --noEmit`. Accept this risk until live env is available.

---

## ADR-008 — Client-side page reload after refresh; no RSC revalidation

**Decision date:** 2026-10-10  
**Status:** ACTIVE — revisit in Phase 4

**Context:**  
After a successful `POST /api/prices/refresh`, the portfolio page (a Server Component) shows stale prices until it re-renders. The `RefreshPricesButton` uses `window.location.reload()` after a 1.5-second delay to trigger a fresh page load.

**Evidence inspected:**
- `components/ui/RefreshPricesButton.tsx` — `setTimeout(() => window.location.reload(), 1500)`
- `app/(dashboard)/portfolio/page.tsx` — Server Component, data fetched at render time; no route segment revalidation

**Decision:**  
Use `window.location.reload()` for now. In Phase 4, replace with `router.refresh()` from `next/navigation` + `revalidatePath('/portfolio')` on the server side (requires upgrading the handler to use Next.js cache tags).

**Rationale:** `window.location.reload()` is simple and reliable. The 1.5s delay lets the user see the "Updated N holdings" success message before reload. RSC cache invalidation is a more complex Next.js pattern deferred to Phase 4.

**Risk:** Hard reload discards any client-side state (e.g., open filters). For the current implementation this is acceptable.

---

## ADR-009 — Defer Profile / Multi-Profile feature

**Decision date:** 2026-10-10  
**Status:** ACTIVE

**Context:**  
Phase 2 (`LEDGER-002`) asks to decide if `Profile`/multi-profile (e.g. tracking "Personal" vs "Family" under one user) is required for the target release.

**Decision:**  
Multi-profile is deferred indefinitely. The `userId` combined with explicit `Account` entities provides sufficient isolation and organization for MVP. If users need logical groupings, they can use `tags` or naming conventions on Accounts.

**Rationale:** Adding a `Profile` entity would complicate every single query (`where: { userId, profileId }`), require UI dropdowns everywhere, and complicate import idempotency.

**Risks:** Users managing multiple completely separate financial lives (e.g. personal vs business) under one login will have blended net worth. They must use separate accounts or tags to filter.
