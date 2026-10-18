# FinanceAI — Comprehensive Product and Technical Architecture

**AI-Powered Personal Finance, Wealth Tracking, Investment Analytics, and Financial Planning Platform**

> **Document version:** 2.1 (Implementation-Aware Blueprint — October 2026)  
> **Stack:** Next.js 14 (App Router) • TypeScript • PostgreSQL • Prisma ORM • Clerk Auth • MiniMax AI • Yahoo Finance • mfapi.in  
> **Status key:** ✅ Implemented in Codebase | 🔄 Partial / In Progress | 📋 Target Requirement | ❓ Unverified / Investigation Needed

---

## Table of Contents

1. [Executive Summary and Product Scope](#1-executive-summary-and-product-scope)
2. [Verified Current State Audit](#2-verified-current-state-audit)
3. [Complete Feature Coverage Matrix](#3-complete-feature-coverage-matrix)
4. [Current vs. Target Database Design](#4-current-vs-target-database-design)
5. [API Route and Service Contracts](#5-api-route-and-service-contracts)
6. [Technical and Financial Assumptions](#6-technical-and-financial-assumptions)
7. [Dependency-Aware Implementation Roadmap](#7-dependency-aware-implementation-roadmap)
8. [Detailed Feature Specifications and Research (Appendices)](#8-detailed-feature-specifications-and-research-appendices)

---

## 1. Executive Summary and Product Scope

### 1.1 Vision and Positioning
**FinanceAI** is a modern, privacy-first personal wealth management, portfolio analytics, and financial planning platform. 

This architecture serves as the definitive blueprint, rectifying previous design gaps and aligning the target architecture precisely with the existing source code and the detailed competitive benchmark analysis (FinBoom Audit).

### 1.2 Core Value Proposition
- **Unified Balance Sheet & Net Worth:** Real-time consolidation of 20+ asset classes alongside liabilities.
- **Privacy-Preserving Statement Ingestion:** Manual and CSV-based ingestion (currently supporting Groww and INDmoney), scaling towards CAS PDF imports, without requiring intrusive open-banking credentials.
- **Deterministic Analytics Engine:** XIRR, CAGR, debt amortization, and FIRE planning.
- **AI Advisory:** Context-aware guidance powered by MiniMax AI, rigorously separated from deterministic math and scrubbed of PII.

---

## 2. Verified Current State Audit

A rigorous validation pass was conducted against the active codebase (`src/`, `prisma/`, `app/`). Claims from previous architecture drafts have been corrected to reflect reality.

| Component / Module | Implementation Status | Real Codebase Findings | Gap / Target Architecture |
|---|---|---|---|
| **Auth & User Management** | ✅ Implemented | Clerk integration is active. Prisma `User` model exists. | Missing multi-profile support (e.g., Personal vs Family). |
| **Database Schema** | 🔄 Partial | Prisma contains `Asset`, `Transaction`, `Liability`, `Goal`, `Budget`, `Snapshot`, `AIConversation`. | Missing explicit `Account` model, `ImportBatch`, `FXRate`, and `LoanAmortizationSchedule`. |
| **Asset Register** | 🔄 Partial | Exists, but flat structure. `Asset` model tracks `avgBuyPrice`, `currentPrice`, and uses a simple string `type`. | Need standardized 20+ asset types, multi-currency accounting, and split cost-basis tracking. |
| **Import System (Broker CSV)** | ✅ Implemented | Robust adapters exist for **Groww** (Mutual Fund & Stock) and **INDmoney** (Mutual Fund & US Stock). | Missing CAS PDF parser, generic CSV mapper, and Zerodha support. |
| **CAS PDF Parser** | ❌ Not Implemented | No PDF parsing logic exists in the codebase. | Target requirement: Ephemeral PDF parsing via `pdfjs-dist`. |
| **Pricing Engine** | ✅ Implemented | `PriceEngineService` fetches from `mfapi.in` and `Yahoo Finance` via adapters. | Prices are cached in-memory (`src/lib/cache.ts`); target requires persistent Redis/Postgres caching. |
| **Debt Amortization** | ❌ Not Implemented | `Liability` tracks outstanding amount, but no amortization schedule generation exists. | Implement full amortization math engine. |
| **Financial Health Score**| ❌ Not Implemented | Not present in the active codebase. | Implement 5-pillar mathematical engine. |
| **AI Advisor** | 🔄 Partial | `AIConversation` exists. Basic prompts are passed. | Need strict PII masking gateway and deterministic numeric injection. |
| **Transactions deduplication** | 🔄 Partial | Exists somewhat via `importKey`, but lacks account-level isolation. | Idempotency must include `accountId` to avoid rejecting legitimate identical transactions across users/accounts. |


## 3. Complete Feature Coverage Matrix

This exhaustive matrix maps every capability identified in the FinBoom audit against the active codebase and the intended architecture target.

| FinBoom Audit Feature | Current Codebase Status | Target Requirement | Priority | Dependencies / Notes |
|---|---|---|---|---|
| **Dashboard & Overview** | | | | |
| Net worth summary & Allocation donut | 🔄 Partial | Real-time calculation with UI donuts | High | Requires Snapshot model & UI components |
| Monthly cash-flow summary | 🔄 Partial | Present income vs expenses | High | Depends on categorization & transaction rules |
| Privacy Mode Toggle | ✅ Implemented | Eye-icon toggle masking | Medium | Stored in User model |
| **Wealth & Assets** | | | | |
| Asset Register (20+ classes) | 🔄 Partial | Full taxonomy | High | Enum expansion needed in Prisma |
| Multi-currency valuation | 🔄 Partial | Base vs display conversion | High | Depends on `FXRate` API integration |
| Live asset prices | ✅ Implemented | Yahoo & mfapi.in providers | High | Move caching to Redis |
| Cost basis & Investment cost tracking | ✅ Implemented | Track `avgBuyPrice` | High | |
| **Liabilities & Accounts** | | | | |
| Accounts module & mapping | ❌ Not Implemented | Explicit `Account` model | High | Essential for cross-account transfers |
| Cross-account transfers | ❌ Not Implemented | Paired transaction records | High | Requires `Account` model |
| Debt register & Loan details | 🔄 Partial | Exists as flat `Liability` | High | |
| Loan amortization schedule | ❌ Not Implemented | Breakdown of principal & interest | Medium | Requires math engine library |
| **Cash Flow & Transactions** | | | | |
| Transaction ledger | ✅ Implemented | CRUD operations | High | |
| Category hierarchy & rules | ❌ Not Implemented | Nested categories & auto-tagging | Medium | Required for smart categorization |
| Recurring transactions | ❌ Not Implemented | Cron-based generation | Medium | Vercel Cron worker needed |
| Deduplication engine | 🔄 Partial | Idempotency key per account | High | Fix `importKey` logic to include account/profile context |
| **Financial Insights & Budgets** | | | | |
| Envelope budgets & alerts | ✅ Implemented | `Budget` model limits & 80/100 thresholds | High | |
| Financial health score | ❌ Not Implemented | 5-pillar mathematical score | Medium | |
| **Goals & Planning** | | | | |
| Goal tracking | ✅ Implemented | `Goal` model | High | |
| Inflation adjustment engine | ❌ Not Implemented | Forward-looking valuation | Low | |
| Goal-to-asset explicit linking | ❌ Not Implemented | Avoid double counting assets | Medium | Target model: `GoalAssetLink` |
| **Calculators** | | | | |
| SIP, Lumpsum, EMI calculators | ❌ Not Implemented | Client-side visual tools | Low | Client-side TS math components |
| Prepayment & FIRE planner | ❌ Not Implemented | Advanced planning | Low | |
| **Import Pipeline** | | | | |
| Groww & INDmoney CSV Import | ✅ Implemented | Extracting folios, prices, types | High | Existing adapters must be preserved |
| Zerodha, Upstox, ICICI direct | ❌ Not Implemented | Adapter registry expansion | Medium | |
| CAMS/KFintech CAS PDF Import | ❌ Not Implemented | Password decryption + text parsing | High | Requires `pdfjs-dist` |
| **Settings & Profiles** | | | | |
| Multi-profile / Shared access | ❌ Not Implemented | `AccountProfile` authorization | Medium | Core architectural change to RBAC |
| Data Export (CSV/JSON) | ❌ Not Implemented | Download raw ledger | Low | |
| Account Deletion (GDPR/RTBF) | ❌ Not Implemented | Cascade delete logic | High | Prisma `onDelete: Cascade` handles mostly |

## 4. Current vs. Target Database Design

### 4.1 Required Migrations & Schema Fixes
The existing `prisma/schema.prisma` handles basic asset and transaction logic well, but lacks crucial structural separation for bank accounts and import batches. To support robust deduplication and cross-account transfers, the schema must evolve.

**Key Corrective Actions:**
1. **Explicit `Account` Model:** Transactions currently store `account` as a flat string. An `Account` model (or `AccountProfile`) is required to represent bank accounts, wallets, and brokerages as distinct entities owned by a User.
2. **Transfer Entity & Foreign Keys:** Transfers currently exist as a single `Transaction` type. They must be split into paired (Debit / Credit) transactions linked by a `transferGroupId`.
3. **Account-Level Deduplication Hash:** The `importKey` on Assets and the deduplication hash on Transactions must be scoped by `accountId` + `userId` to prevent dropping legitimate identical transactions from different accounts.
4. **Historical Immutability:** Add `AssetPriceHistory` and `FXRate` to store time-series data, ensuring past net-worth snapshots don't break when live prices change.

### 4.2 Proposed Target Entities (Delta from Current)

```prisma
// ── Proposed Additions & Modifications to schema.prisma ──

// Accounts are distinct from Assets (e.g. HDFC Checking vs Reliance Shares)
model Account {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String        // "HDFC Bank", "Zerodha Wallet"
  type         String        // BANK | BROKERAGE | WALLET | CREDIT_CARD
  currency     String        @default("INR")
  transactions Transaction[]
  
  @@index([userId])
}

// Transaction must relate to an explicit Account, and include a transferGroupId
model Transaction {
  id              String    @id @default(cuid())
  userId          String
  // ... existing fields
  accountId       String?   // Replaces flat string
  account         Account?  @relation(fields: [accountId], references: [id], onDelete: Restrict)
  transferGroupId String?   // UUID linking the debit & credit pair
  dedupHash       String?   // sha256(date+amount+accountId+rawDescription)
  
  @@unique([userId, accountId, dedupHash]) // Corrected Idempotency
}

// Time-series persistence for performance and historical accuracy
model AssetPriceHistory {
  id        String   @id @default(cuid())
  assetId   String
  price     Float
  currency  String
  source    String   // YAHOO | MFAPI | MANUAL
  timestamp DateTime @default(now())

  @@index([assetId, timestamp])
}

// Amortization schedule to support prepayment scenarios
model LoanAmortizationSchedule {
  id            String    @id @default(cuid())
  liabilityId   String
  installmentNo Int
  dueDate       DateTime
  principal     Float
  interest      Float
  remainingBal  Float
  isPaid        Boolean   @default(false)

  @@index([liabilityId, installmentNo])
}
```

---

## 5. API Route and Service Contracts

Every target module has a clear service owner. The architecture enforces strict bounds: API Routes handle HTTP and Authorization (Clerk), while `.service.ts` files handle pure business logic and DB calls.

### 5.1 Service Layer Owners
- **`ImportService`**: (Exists) Handles generic CSV parsing, Groww/INDmoney adapters, and handles staging.
- **`PriceEngineService`**: (Exists) Orchestrates `mfapi.in` and `Yahoo Finance` quotes.
- **`TransactionService`**: (Exists) To be expanded for atomic double-entry transfer logic.
- **`AccountService`**: (Proposed) New owner for cross-account and multi-profile logic.
- **`FinancialEngineService`**: (Proposed) Pure math layer for XIRR, CAGR, Amortization, and Health Score.

### 5.2 Key Missing Endpoint Contracts

| Endpoint Path | Method | Auth | Payload / Params | Idempotency / Notes |
|---|---|---|---|---|
| `/api/v1/accounts` | `POST` | Clerk JWT | `{ name, type, currency }` | Unique constraint on `userId` + `name` |
| `/api/v1/transactions/transfer` | `POST` | Clerk JWT | `{ fromAccountId, toAccountId, amount, date }` | Must be an atomic Prisma `$transaction` |
| `/api/v1/import/cas` | `POST` | Clerk JWT | `FormData { file, password }` | Ephemeral parsing; no disk persistence. |
| `/api/v1/export` | `GET` | Clerk JWT | `?format=csv&year=2026` | Generates ledger export string directly from DB. |

## 6. Technical and Financial Assumptions

A rigorous evaluation of current capabilities reveals the following true state of assumptions and constraints:

1. **Pricing Realities (Not "Real-Time"):** Quotes fetched from Yahoo Finance and `mfapi.in` are EOD (End of Day) or delayed by 15-20 minutes. There are no WebSockets streaming live tick data. Architecture must reflect "Daily or On-Demand Refresh" rather than "Real-Time."
2. **Caching Constraints:** The current cache (`src/lib/cache.ts`) is a transient in-memory Map. It will lose data on serverless cold starts. A Redis instance (Upstash) or Postgres-backed caching table is strictly required for production deployment on Vercel.
3. **FX Processing:** Currently missing an automated pipeline for FX API integration. All multi-currency assets are subject to manual conversion or missing historical FX tracking until an FX cron job is implemented.
4. **File Security & Memory Limits:** Parsing large CAS PDFs ephemerally in RAM within a Next.js API route may hit Vercel's 50MB execution limit. Heavy CAS files may require offloading to a dedicated background worker.

---

## 7. Dependency-Aware Implementation Roadmap

This roadmap correctly starts from the existing, working FinanceAI codebase, preserving built capabilities while extending them to match the target FinBoom specifications.

### Phase 1: Solidify the Data Model & Existing Integrations
1. **Database Migration:** Deploy `Account`, `AssetPriceHistory`, and updated `Transaction` (deduplication) models.
2. **Preserve Importers:** Ensure the existing **Groww** and **INDmoney** adapters continue to function perfectly with the new schema.
3. **Replace In-Memory Cache:** Implement Redis/Upstash to stabilize the existing `PriceEngineService`.

### Phase 2: Missing Core Financial Modules (The Debt Engine)
1. **Loan Amortization Engine:** Implement deterministic math for principal/interest splitting.
2. **Cross-Account Transfers:** Build the atomic double-entry logic for moving cash between `Accounts`.
3. **Multi-Currency FX Baseline:** Integrate an FX provider to convert USD assets (from INDmoney adapter) into the base INR display.

### Phase 3: Analytics, Planners, and Automation
1. **Financial Health Score:** Implement the 5-pillar mathematical engine.
2. **7-in-1 Calculators Suite:** Build client-side interactive calculators (SIP, EMI, FIRE).
3. **Cron Job Infrastructure:** Establish Vercel Cron routes for daily NAV/Stock updates and recurring transactions.

### Phase 4: Privacy, Import Expansion, and AI Optimization
1. **CAS PDF Parser:** Implement `pdfjs-dist` ephemeral parser for CAMS/KFintech.
2. **PII Masking Gateway:** Refactor the existing MiniMax AI integration to ensure account numbers and real names are regex-scrubbed before LLM transmission.
3. **Data Export & Deletion:** Implement GDPR-compliant JSON/CSV ledger exports and cascade account deletion.

---

## 8. Detailed Feature Specifications and Research (Appendices)

*This section preserves the critical qualitative observations from the original FinBoom audit that guide UI/UX and edge-case development.*

### Appendix A: FinBoom Benchmark Workflows to Emulate
- **Privacy-First Posture:** FinBoom explicitly avoids "connect your bank" screens. FinanceAI must follow this by heavily emphasizing drag-and-drop CSVs and manual entries over Plaid/Yodlee integrations.
- **Goal-to-Asset Mapping (No Double Counting):** When an asset (e.g., an FD) is linked to an "Emergency Fund" goal, the UI must visually deduct that allocated amount from the general unallocated pool.
- **Snapshot Immutability:** Historical net worth is generated by a monthly "Snapshot" cron job, storing a frozen numeric state. This ensures that past net worth charts don't rewrite themselves if an old asset's cost basis is modified today.
- **Staging UI for Imports:** All CSV/PDF imports must land in a "Staging" table first. The user must be presented with a preview of "New vs Duplicate" rows before committing the batch.

---

*End of FinanceAI_Architecture_v2.1.md*


## 9. Open Decisions, Evidence Gaps, and Risks

### 9.1 Open Decisions
- **Caching Mechanism:** The current `src/lib/cache.ts` is purely in-memory. For serverless deployments (Vercel), we must definitively decide between a hosted Redis solution (Upstash) or leveraging the PostgreSQL database for price caching to prevent cold-start data loss.
- **Background Worker Infrastructure:** Given Vercel's execution limits, heavy tasks like PDF parsing and daily global price refreshes may require an external queue (e.g., QStash or BullMQ) rather than standard API routes.

### 9.2 Evidence Gaps
- **Real-Time Claims:** V2.0 claimed "real-time" pricing. Code analysis reveals this is technically End-of-Day (EOD) or 15-minute delayed polling. The architecture now correctly states "daily/on-demand refresh."
- **Full FinBoom Feature Parity:** Certain FinBoom features (e.g., exact financial health formulas, FX provider details) lack technical evidence. Our architecture targets comparable functionality but acknowledges these gaps.

### 9.3 Technical Risks
- **CAS PDF Password Handling:** Parsing encrypted PDFs securely without writing to disk is complex. If RAM usage spikes during decryption, serverless functions may crash.
- **Deduplication Edge Cases:** If users import identical transactions across different profiles (e.g., joint accounts), a poorly scoped `importKey` will wrongly reject them. The proposed `userId_accountId_dedupHash` mitigates this.

---

## 10. Change Report: v2.0 vs. v2.1

A rigorous validation pass was performed on Version 2.0 to align it with the actual codebase and correct unverified claims.

**What was corrected in Version 2.1:**
1. **Current State Grounding:** Removed incorrect "Implemented" checkboxes for features that exist only as concepts (e.g., CAS PDF parser, Loan Amortization math, Health Score). Acknowledged the excellent, working **Groww** and **INDmoney** CSV importers.
2. **Schema Correction:** Identified that V2.0 proposed several models (e.g., `AccountProfile`, `AssetPriceHistory`) that did not exist in `schema.prisma`. Separated the *current* flat schema from the required *target* schema and specified the necessary migrations.
3. **Deduplication Fix:** Corrected the transaction deduplication logic to include `accountId`, preventing legitimate transactions from being erroneously blocked across different users or profiles.
4. **Roadmap Realignment:** Scrapped the implicit "rebuild from scratch" roadmap. The new roadmap focuses on preserving existing components (like the broker adapters) while sequentially adding the missing DB models, caching layers, and deterministic engines.
5. **Assumption Checks:** Clarified that the current cache is in-memory (not Redis) and that pricing is polled/delayed (not WebSockets).


