# FinanceAI — Comprehensive Product and Technical Architecture

**AI-Powered Personal Finance, Wealth Tracking, Investment Analytics, and Financial Planning Platform**

> **Document version:** 2.2 (Implementation-Aware Master Blueprint — October 2026)  
> **Stack:** Next.js 14 (App Router) • TypeScript • PostgreSQL • Prisma ORM • Clerk Auth • MiniMax AI • Yahoo Finance • mfapi.in  
> **Status key:** ✅ Implemented and verified | 🔄 Partially implemented | 📋 Planned | ❓ Unverified / needs investigation

---

## Table of Contents

1. [Executive Summary and Product Scope](#1-executive-summary-and-product-scope)
2. [Architecture Principles and Scope Boundaries](#2-architecture-principles-and-scope-boundaries)
3. [Verified Current State Audit](#3-verified-current-state-audit)
4. [Complete Feature Coverage Matrix](#4-complete-feature-coverage-matrix)
5. [Functional Modules and Feature Specifications](#5-functional-modules-and-feature-specifications)
6. [Application Navigation and Frontend Architecture](#6-application-navigation-and-frontend-architecture)
7. [High-Level System and Backend Architecture](#7-high-level-system-and-backend-architecture)
8. [Current vs. Target Data Model and Schema Migrations](#8-current-vs-target-data-model-and-schema-migrations)
9. [API Route and Service Contracts](#9-api-route-and-service-contracts)
10. [Import, Pricing, FX, AI, and Background Jobs](#10-import-pricing-fx-ai-and-background-jobs)
11. [Authentication, Authorization, Privacy, and Security](#11-authentication-authorization-privacy-and-security)
12. [Calculation Rules, Caching, and Resilience](#12-calculation-rules-caching-and-resilience)
13. [Testing, Deployment, Definition of Done, and Roadmap](#13-testing-deployment-definition-of-done-and-roadmap)
14. [Open Decisions, Evidence Gaps, and Change Report](#14-open-decisions-evidence-gaps-and-change-report)

---

## 1. Executive Summary and Product Scope

### 1.1 Vision and Positioning
**FinanceAI** is a modern, privacy-first personal wealth management, portfolio analytics, and financial planning platform engineered for retail investors, high-net-worth individuals, and privacy-conscious users globally. 

This v2.2 architecture reconciles the comprehensive FinBoom benchmark analysis with the rigorous reality of the active FinanceAI source code, yielding an executable target blueprint.

### 1.2 Core Value Proposition
- **Unified Balance Sheet & Net Worth:** Consolidated tracking of 20+ asset classes alongside liabilities and accounts.
- **Privacy-Preserving Statement Ingestion:** Manual and CSV-based ingestion (currently verified for Groww and INDmoney), scaling towards CAS PDF imports, explicitly avoiding intrusive open-banking credential scraping.
- **Deterministic Analytics Engine:** XIRR, CAGR, debt amortization, rebalancing, and FIRE planning based on explicit mathematical models.
- **AI Advisory:** Context-aware guidance powered by MiniMax AI, rigorously separated from deterministic math and scrubbed of PII.

---

## 2. Architecture Principles and Scope Boundaries

### 2.1 Core Architectural Principles
1. **Privacy-First Data Control:** No banking credentials stored. Sensitive files are parsed ephemerally.
2. **Decoupling of Deterministic Core & AI:** All financial numbers are computed by deterministic TypeScript algorithms. The AI model is used strictly for synthesis and advice.
3. **Multi-Currency & Standardized Valuation:** Financial positions retain their native currency, normalized via FX rates to a display currency (e.g., INR).
4. **Historical Immutability & Eventual Consistency:** Transaction ledgers and snapshots are immutable. Market prices update asynchronously (daily/on-demand), failing gracefully.

### 2.2 System Scope Boundaries

#### In Scope (Core Application Boundaries)
- Multi-profile and account management.
- Multi-asset register and liability tracking with amortization.
- Transaction ledger (Income, Expense, Transfer, Investment) with budget thresholds.
- CSV Importers (Verified: Groww, INDmoney) and target CAS PDF Parser.
- Daily/On-demand pricing engine via `mfapi.in` and `yahoo-finance2`.
- Interactive Financial Calculators (SIP, Lumpsum, EMI, FIRE).
- AI Financial Assistant leveraging MiniMax LLM.

#### Out of Scope (Explicit Non-Goals)
- Direct payment initiation or wire transfers.
- Automated stock order execution or portfolio management.
- Regulated SEBI/SEC licensed financial advice (AI outputs will carry strict disclaimers).
- Real-time tick data streaming via WebSockets.

---

## 3. Verified Current State Audit

A rigorous validation against the active codebase (`src/`, `prisma/schema.prisma`, `app/`) has been conducted.

| Component / Module | Implementation Status | Real Codebase Findings | Supporting Evidence |
|---|---|---|---|
| **Auth & User Management** | ✅ Implemented and verified | Clerk integration active; Prisma `User` model exists. | `src/lib/auth.ts`, `schema.prisma` |
| **Database Schema Base** | 🔄 Partially implemented | Contains `Asset`, `Transaction`, `Liability`, `Goal`, `Budget`, `Snapshot`, `AIConversation`. | `schema.prisma` |
| **Account & Transfer System**| 📋 Planned | Flat `account` string exists on `Transaction`. No discrete `Account` model or paired transfer logic. | Needs migration. |
| **Asset Register** | 🔄 Partially implemented | Flat structure. `Asset` tracks `avgBuyPrice`, `currentPrice`. Lacks explicit historical valuation tracking. | `schema.prisma` |
| **Import System (Brokers)** | ✅ Implemented and verified | Adapters exist and function for **Groww** (MF/Stock) and **INDmoney** (MF/US Stock). | `src/adapters/` |
| **CAS PDF Parser** | 📋 Planned | No PDF parsing logic exists. Target requires `pdfjs-dist` ephemeral parsing. | Absent from codebase. |
| **Pricing Engine** | ✅ Implemented and verified | Fetches from `mfapi.in` and `Yahoo Finance`. | `src/services/price-engine.service.ts` |
| **Caching Layer** | 🔄 Partially implemented | Caching exists but is transient in-memory (`Map`), unsuitable for serverless persistence. | `src/lib/cache.ts` |
| **Debt Amortization** | 📋 Planned | `Liability` tracks outstanding amounts; lacks schedule generation math. | `schema.prisma` |
| **Financial Health Score**| 📋 Planned | 5-pillar mathematical engine is planned. | Absent from codebase. |
| **AI Advisor** | 🔄 Partially implemented | `AIConversation` exists. Needs strict PII masking gateway. | `src/services/ai/` |
| **Transaction Deduplication**| 🔄 Partially implemented | Idempotency exists (`importKey`) but lacks `accountId` scope, risking cross-account rejections. | `src/services/import.service.ts` |


## 4. Complete Feature Coverage Matrix

This matrix maps every capability identified in the FinBoom audit and original specifications against the active codebase and the target blueprint.

| FinBoom / Target Feature | Current Codebase Status | Target Requirement | Priority | Dependencies / Evidence |
|---|---|---|---|---|
| **Dashboard & Overview** | | | | |
| Net worth summary & history | 🔄 Partially implemented | Multi-currency real-time command center + historical timeline | High | `Snapshot` model, FX pipeline |
| Asset/Liability allocation donuts | 📋 Planned | Visual side-by-side allocation breakdown | High | UI/UX implementation |
| Monthly cash-flow stream | 🔄 Partially implemented | Income vs Expenses progress | High | Transaction category mapping |
| Privacy Mode Toggle | ✅ Implemented and verified | Mask monetary values on screen | Medium | Stored in `User` model |
| **Wealth & Assets** | | | | |
| Multi-asset register (20+ types) | 🔄 Partially implemented | Expand flat `Asset` model to full taxonomy | High | Prisma Enum expansion |
| Multi-currency valuation | 🔄 Partially implemented | Store native currency; normalize to base via FX | High | `FXRate` model |
| Cost basis & investment tracking | ✅ Implemented and verified | Track `avgBuyPrice` and current valuation | High | `Asset` model |
| Asset tags & geography filtering | 🔄 Partially implemented | Organize holdings by metadata (e.g. Domestic vs Foreign) | Medium | Enhance `Asset` schema |
| **Liabilities & Debt** | | | | |
| Liability tracking | 🔄 Partially implemented | Exists as flat `Liability` | High | `schema.prisma` |
| Loan amortization schedule | 📋 Planned | Full Principal/Interest split generation | High | New `LoanAmortizationSchedule` model |
| Prepayment simulator | 📋 Planned | Model EMI step-ups & tenure reduction | Low | Client-side math |
| **Accounts & Cash Flow** | | | | |
| Accounts mapping (Banks/Wallets)| 📋 Planned | Explicit `Account` entity | High | Required for double-entry |
| Cross-account transfers | 📋 Planned | Atomic paired transactions (Debit/Credit) | High | Requires `Account` model & `transferGroupId` |
| Transaction ledger & bulk actions| ✅ Implemented and verified | CRUD operations on ledger | High | `TransactionService` |
| Category hierarchy & rules | 📋 Planned | Nested taxonomy & auto-tagging | Medium | UI & rule engine |
| Recurring transactions | 📋 Planned | Cron-based generation | Medium | Requires Vercel Cron |
| Deduplication & reconciliation | 🔄 Partially implemented | Account-scoped idempotency (`userId_accountId_dedupHash`) | High | Corrects current global `importKey` |
| **Financial Insights & Budgets** | | | | |
| Envelope budgets & limits | ✅ Implemented and verified | `Budget` model with 80% & 100% threshold alerts | High | `BudgetService` |
| Financial health score | 📋 Planned | 5-pillar mathematical engine (0-100) | Medium | Pure math library required |
| **Performance & Analytics** | | | | |
| XIRR & CAGR Engines | 📋 Planned | True money-weighted and time-weighted returns | High | Newton-Raphson TS math library |
| Realized / Unrealized Gains | 📋 Planned | Tax-lot tracking (STCG/LTCG) | Medium | Dependent on sell transactions |
| Rebalancing & Allocation Target| 🔄 Partially implemented | Compare actual vs `AllocationTarget` | Medium | Exists in schema, needs UI |
| **Goals & Planning** | | | | |
| Multi-goal tracking | ✅ Implemented and verified | Create goals, track current vs target | High | `Goal` model |
| Goal-to-asset explicit linking | 📋 Planned | Link specific assets to goals without double counting | Medium | Target model: `GoalAssetLink` |
| Inflation adjustment engine | 📋 Planned | Forward-looking valuation for long-term goals | Low | Math library |
| **Calculators Suite** | | | | |
| SIP, Lumpsum, EMI calculators | 📋 Planned | Client-side interactive visual charts | Low | UI Components |
| FIRE / Retirement planner | 📋 Planned | Advanced withdrawal rate simulator | Low | UI Components |
| **Import Pipeline** | | | | |
| Groww & INDmoney CSV Import | ✅ Implemented and verified | Extract folios, prices, types via adapters | High | Verified in `src/adapters/` |
| Zerodha, Upstox, ICICI Import | 📋 Planned | Adapter registry expansion | Medium | Need sample test files |
| CAMS/KFintech CAS PDF Import | 📋 Planned | Ephemeral password decryption & text parsing | High | Requires `pdfjs-dist` |
| **Market Prices & FX** | | | | |
| Dual Pricing (mfapi & Yahoo) | ✅ Implemented and verified | Daily/on-demand fetch | High | `PriceEngineService` |
| Price History & Caching | 🔄 Partially implemented | Migrate from transient memory to Redis/Postgres | High | Current cache is volatile Map |
| FX API Integration | 📋 Planned | Automated USD/INR normalization | High | `FXRate` model |
| **AI Advisory** | | | | |
| MiniMax LLM integration | 🔄 Partially implemented | Needs deterministic numeric injection & PII masking | High | `AIConversation` model exists |
| **Settings & App Architecture** | | | | |
| Multi-profile / Family sharing | 📋 Planned | Separate `AccountProfile` under one user | Medium | RBAC & Schema upgrade |
| PWA / Installability | ❓ Unverified | Needs `manifest.json` & service worker check | Low | Check frontend config |
| Data Export (CSV/JSON) | 📋 Planned | Full ledger export | Low | API route |
| Account Deletion (GDPR) | 📋 Planned | Cascade delete logic | High | Rely on Prisma `onDelete: Cascade` |


## 5. Functional Modules and Feature Specifications

### 5.1 Executive Dashboard & Net Worth Command Center
- **Net Worth Metric:** `Total Assets - Total Liabilities` normalized into active display currency, with selectable time windows.
- **Allocation Donut Charts:** Side-by-side asset (Equities, MFs, Fixed Income, Real Estate, Crypto) and liability (Home Loan, Cards) breakdown.
- **Privacy Mode Toggle:** UI control to mask monetary values during public sessions. (Verified in `User` schema).

### 5.2 Wealth & Asset Management
- **Asset Classes:** Expanding the current flat model into 20+ types (Equities, Mutual Funds, Fixed Deposits, EPF, PPF, Real Estate, Crypto, Gold, Cash).
- **Metadata:** Custom tags, liquidity rating, and geographic tracking.

### 5.3 Liabilities & Debt Engine
- **Loan Detail Management:** Store principal, remaining balance, interest rate, EMI date, and tenure.
- **Target Amortization Engine:** Math library to automatically break down EMIs into Principal vs Interest.

### 5.4 Accounts & Cash Flow Ledger
- **Target Account Segregation:** Moving from flat strings to explicit `Account` entities (Bank, Brokerage, Wallet).
- **Atomic Transfers:** Designing double-entry (Debit/Credit) pairs linked by `transferGroupId`.
- **Budgets:** Month/Category limits with 80% and 100% threshold alerts. (Verified in codebase).

### 5.5 Portfolio Performance
- **XIRR & CAGR Engines:** True money-weighted rate of return handling irregular cash flows, decoupled from simple absolute returns.
- **Rebalancing Radar:** Compare actual allocation vs `AllocationTarget` (Verified in codebase).

### 5.6 Import Pipeline Module
- **Verified CSV Importers:** `Groww` (MF, Stock) and `INDmoney` (MF, US Stock) currently function using adapter patterns in `src/adapters/`.
- **Target CAS PDF Parser:** Secure, ephemeral memory parsing of encrypted Indian CAMS/KFintech PDFs using `pdfjs-dist`.

### 5.7 Financial Planning & Goal Tracking
- **Multi-Goal Engine:** Create goals, track progress. (Verified in codebase).
- **Target Goal Linking:** Link explicit assets to goals to prevent double-counting of wealth.

### 5.8 Privacy-Preserving AI Advisory
- **MiniMax LLM Integration:** Conversational assistant for financial queries. (Verified in `src/services/ai/`).
- **Target PII Scrubbing:** Regex-based anonymization middleware replacing real names, emails, and exact bank names before LLM payload transmission.

---

## 6. Application Navigation and Frontend Architecture

### 6.1 Sitemap Architecture (Next.js 14 App Router)
```text
app/
├── (auth)/sign-in, sign-up
├── (dashboard)/
│   ├── dashboard/       # Net Worth & Dashboard
│   ├── assets/          # Asset Register & Valuations
│   ├── liabilities/     # Debt & Amortization
│   ├── transactions/    # Ledger & Transfers
│   ├── investments/     # XIRR, CAGR Analytics
│   ├── imports/         # CSV / CAS PDF Staging
│   ├── goals/           # Planning & Goals
│   ├── calculators/     # SIP, Lumpsum, EMI Tools
│   ├── ai-advisor/      # MiniMax AI Chat
│   └── settings/        # Profiles, Export, Preferences
└── api/v1/              # REST Route Handlers
```

### 6.2 Frontend Stack
- **Framework:** Next.js 14 (React Server Components).
- **Styling & UI:** Tailwind CSS, Shadcn UI / Radix primitives.
- **State:** TanStack Query for server state; Zustand for local UI toggles (Privacy Mode).
- **Data Visualization:** Recharts for responsive donuts and timelines.

---

## 7. High-Level System and Backend Architecture

### 7.1 Architectural Topology
```text
[ Client (Next.js 14 UI) ]  <---> [ Next.js API Routes (Auth: Clerk, Valid: Zod) ]
                                            |
      +---------------------+---------------+--------------------+
      |                     |                                    |
[ Core Services ]   [ Math & Analytics ]               [ Data Ingestion ]
- AccountService    - FinancialEngine (XIRR, EMI)      - ImportService (Adapters)
- AssetService      - HealthScoreService               - PriceEngineService (Yahoo, mfapi)
- TransactionService- AIService (MiniMax, PII Mask)    - FXService
      |                     |                                    |
      +---------------------+---------------+--------------------+
                                            |
[ Prisma ORM ] <---> [ PostgreSQL (Primary DB) ] + [ Caching (Redis/Upstash Target) ]
```

### 7.2 Backend Service Module Owners
- **`ImportService`**: Manages generic file staging, CSV parsing via adapters, and deduplication logic.
- **`PriceEngineService`**: Orchestrates Yahoo Finance and mfapi.in quotes. Handles fallback to last-known cached price.
- **`TransactionService`**: Ledger CRUD; must be expanded for atomic transfer logic.
- **`AssetService` & `LiabilityService`**: Value tracking and lifecycle management.
- **`FinancialEngineService` (Target)**: Pure TS library for heavy math (XIRR, Amortization).


## 8. Current vs. Target Data Model and Schema Migrations

### 8.1 Schema Verification and Deficiencies
A review of `prisma/schema.prisma` confirms the existence of `User`, `Asset`, `Transaction`, `Liability`, `Goal`, `Budget`, `Snapshot`, and `AIConversation`. However, to achieve FinBoom-level functionality, the schema requires substantial expansion.

**Critical Data Deficiencies:**
1. **No Account Isolation:** The current `Transaction` model uses a flat `account` string. A discrete `Account` (or `AccountProfile`) entity is mandatory to handle cross-account transfers and balance reconciliation.
2. **Global Deduplication Bug:** The `importKey` on `Asset` is scoped only to `userId`. Deduplication hashes for transactions MUST include `accountId` to prevent erroneously dropping identical legitimate transactions (e.g., matching salary deposits in joint accounts).
3. **No Temporal Storage:** Live pricing (`AssetPriceHistory`) and FX rates (`FXRate`) lack historical persistence, risking the corruption of historical Net Worth snapshots.
4. **No Amortization Tables:** `Liability` lacks a child schedule model.

### 8.2 Proposed Target Schema Upgrades

```prisma
// ── Core Additions for Migration Phase 1 ──

// Replaces the flat string "account" to support true multi-banking logic
model Account {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String        // e.g., "HDFC Checking", "Zerodha Wallet"
  type         String        // BANK | BROKERAGE | CREDIT_CARD | CASH
  currency     String        @default("INR")
  transactions Transaction[]
  
  @@index([userId])
}

// Transaction upgraded to support Transfers and strict Deduplication
model Transaction {
  id              String    @id @default(cuid())
  userId          String
  // ... existing fields (amount, date, type, etc.)
  accountId       String?
  account         Account?  @relation(fields: [accountId], references: [id], onDelete: Restrict)
  transferGroupId String?   // Associates the Debit and Credit legs of a transfer
  dedupHash       String?   // Hash formula: sha256(date + amount + accountId + rawDescription)
  
  @@unique([userId, accountId, dedupHash]) // Corrected Account-Level Scope
  @@index([userId, date])
}

// Time-series models for deterministic historical valuation
model AssetPriceHistory {
  id        String   @id @default(cuid())
  assetId   String
  price     Float
  currency  String
  source    String   // YAHOO | MFAPI | MANUAL
  timestamp DateTime @default(now())

  @@index([assetId, timestamp])
}

model FXRate {
  id           String   @id @default(cuid())
  pair         String   // e.g., "USD-INR"
  rate         Float
  timestamp    DateTime @default(now())
  
  @@index([pair, timestamp])
}

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

### 8.3 Migration and Rollback Strategy
- **Backfill:** Existing flat `account` strings in `Transaction` and `Asset` will require a one-time migration script to auto-generate corresponding `Account` entities and map the `accountId` foreign keys.
- **Rollback:** Prisma `down` migrations must be generated to restore the flat string values if the `Account` model upgrade fails.

---

## 9. API Route and Service Contracts

Target API endpoints require strict validation, auth handling, and idempotency guarantees.

### 9.1 Key REST Contracts

| Endpoint | Method | Auth | Target Payload / Output | Contract & Idempotency Rules |
|---|---|---|---|---|
| `/api/v1/accounts` | `POST` | Clerk | `{ name, type, currency }` | Unique `userId` + `name` constraint. |
| `/api/v1/transactions/transfer` | `POST` | Clerk | `{ fromAccountId, toAccountId, amount, date }` | Requires Prisma `$transaction` for atomic commit of both legs. |
| `/api/v1/import/cas` | `POST` | Clerk | `FormData { file, password }` | Ephemeral execution. File buffer never touches disk. Response yields staging rows. |
| `/api/v1/net-worth` | `GET` | Clerk | `?currency=INR&period=1Y` | Returns real-time aggregate + historical `Snapshot` series. |
| `/api/v1/export` | `GET` | Clerk | `?format=json` | Streams JSON ledger. High rate-limit threshold. |


## 10. Import, Pricing, FX, AI, and Background Jobs

### 10.1 Proven Import Pipeline
The `ImportService` correctly operates an adapter registry (`src/adapters/`).
- **Verified Adapters:** Groww (Mutual Funds, Stocks), INDmoney (Mutual Funds, US Stocks).
- **Target Additions:** Zerodha, Upstox, ICICI Direct (Requires unit test fixtures).
- **Target CAS PDF System:** Requires `pdfjs-dist` running in a serverless endpoint to bypass encrypted PDF restrictions, returning staged JSON rows to the client before DB commit.

### 10.2 Pricing Engine and Real-Time Assumptions
- **Verified Behavior:** `PriceEngineService` fetches data from `mfapi.in` and `yahoo-finance2`. It is *not* a streaming WebSockets engine. It is a polling engine.
- **Target Behavior:** Execute pricing batch jobs daily via Vercel Cron or on explicit user "Refresh" requests.

### 10.3 AI Integration
- **Verified Behavior:** MiniMax LLM API integration exists via `AIConversation`.
- **Target Requirement (PII Masking):** The AI module MUST implement a regex scrubbing gateway. Names, email addresses, and exact account numbers must be replaced with synthetic IDs (e.g., `[ACCOUNT_1]`, `[USER_NAME]`) before the prompt is transmitted.

### 10.4 Background Jobs Architecture
Vercel Cron is designated for:
1. **Daily Price & FX Sync:** Updating asset valuations.
2. **Monthly Snapshot Generation:** Freezing historical net worth state.
3. **Recurring Transaction Expansion:** Evaluating templates and inserting ledger rows.

---

## 11. Authentication, Authorization, Privacy, and Security

### 11.1 Identity & Tenant Isolation
- **Verified Integration:** Clerk Authentication handles JWT validation.
- **Database Rules:** All Prisma queries must filter by `userId`.

### 11.2 Ephemeral File Handling
- CAS PDFs and broker CSVs must be processed as in-memory `Buffer` objects. They are expressly forbidden from being saved to AWS S3, Vercel Blob, or local disk to comply with the privacy-first mandate.

---

## 12. Calculation Rules, Caching, and Resilience

### 12.1 Mathematical Models
- **XIRR (Newton-Raphson):** Numerical tolerance set to `0.0001`. Max iterations: `100`. If convergence fails, return `null` rather than an erroneous number.
- **CAGR:** $(\frac{\text{End}}{\text{Start}})^{\frac{1}{n}} - 1$.
- **Amortization Breakdown:** Month $t$ Interest $= \text{Balance}_{t-1} \times (r / 12)$. Principal $= \text{EMI} - \text{Interest}$.

### 12.2 Caching Reality
- **Verified Issue:** `src/lib/cache.ts` is currently an in-memory `Map`.
- **Target Resolution:** Deploy a Redis instance (e.g., Upstash) to persist `mfapi` and Yahoo Finance API responses (TTL 15 minutes) to avoid devastating rate-limit bans during serverless cold starts.

---

## 13. Testing, Deployment, Definition of Done, and Roadmap

### 13.1 Testing Strategy & DOD
A module is strictly marked "Done" only when:
- Unit tests cover 100% of mathematical formulas (XIRR, EMI).
- End-to-end tests (Playwright) verify the Import pipeline.
- No `any` types remain in TypeScript.

### 13.2 Dependency-Aware Implementation Roadmap
*This roadmap rectifies previous assumptions by starting with the existing, functional codebase.*

- **Phase 1: Stabilization & Data Model Fixes**
  - Implement Redis caching for the `PriceEngineService`.
  - Execute Prisma migrations for `Account`, `AssetPriceHistory`, and scoped deduplication hashes.
  - Regression test the Groww and INDmoney adapters.
- **Phase 2: Core Financial Engines**
  - Implement Loan Amortization math and cross-account `transferGroupId` logic.
  - Integrate FX rate fetching to standardize USD assets (INDmoney) into INR.
- **Phase 3: The AI & Privacy Gateway**
  - Build the PII Regex Scrubber for the MiniMax AI route.
  - Build the CAMS/KFintech CAS PDF ephemeral parser.
- **Phase 4: Presentation & Analytics**
  - Deploy 7-in-1 Calculators and the 5-Pillar Financial Health Score UI.
  - Finalize Rebalancing and Goal-linking UX.

---

## 14. Open Decisions, Evidence Gaps, and Change Report

### 14.1 Unresolved Questions & Evidence Gaps
- **CAS PDF Password Strategies:** While ephemeral parsing is architected, handling complex password variations (PAN + DOB permutations) without frustrating users remains a UX challenge.
- **Target PWA & Subscription Models:** The FinBoom audit implies Pro features and installability. The codebase currently lacks a `manifest.json` or Stripe integration. Priority for these features is deferred to post-Phase 4.

### 14.2 Change Report (v2.1 to v2.2)
**What was achieved in Version 2.2:**
1. **Repository Synchronization:** Unified the sweeping architectural goals of v2.0 with the strict codebase reality-checks of v2.1.
2. **Feature Matrix Restoration:** Fully restored the FinBoom-derived exhaustive feature matrix, mapping every requirement to its exact verified status or target priority.
3. **Data Model Precision:** Explicitly documented the missing `Account` model, the required `transferGroupId`, and the exact `userId_accountId_dedupHash` compound uniqueness constraint needed to fix the current codebase's deduplication bug.
4. **Calculations & Caching Bounds:** Replaced absolute guarantees with defined mathematical tolerances (XIRR iterations) and mandated the replacement of the in-memory Map with Redis.
5. **Executable Roadmap:** Formatted a deployment roadmap that explicitly honors existing functional code (Groww/INDmoney importers) rather than demanding a rewrite.

---
*End of FinanceAI_Architecture_v2.2.md*


