# FinanceAI — Comprehensive Product and Technical Architecture

**AI-Powered Personal Finance, Wealth Tracking, Investment Analytics, and Financial Planning Platform**

> **Document version:** 2.0 (Unified — October 2026)  
> **Stack:** Next.js 14 (App Router) • TypeScript • PostgreSQL • Prisma ORM • Clerk Auth • MiniMax AI API • Yahoo Finance API • Indian MF API  
> **Status key:** ✅ Implemented (verified in codebase) | 🔄 Partial / In Progress | 📋 Planned Architecture Target | ❓ Unverified / Proposed

---

## Table of Contents

1. [Executive Summary and Product Scope](#1-executive-summary-and-product-scope)
2. [Architecture Principles and Scope Boundaries](#2-architecture-principles-and-scope-boundaries)
3. [Current State Audit — Verified vs. Claimed Capabilities](#3-current-state-audit--verified-vs-claimed-capabilities)
4. [Functional Modules and Feature Specifications](#4-functional-modules-and-feature-specifications)
5. [Application Navigation and Page Architecture](#5-application-navigation-and-page-architecture)
6. [High-Level System Architecture](#6-high-level-system-architecture)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Backend and Service Architecture](#8-backend-and-service-architecture)
9. [Domain Model and Database Design](#9-domain-model-and-database-design)
10. [API Route and Contract Reference](#10-api-route-and-contract-reference)
11. [Import System Architecture](#11-import-system-architecture)
12. [Price Engine and FX Architecture](#12-price-engine-and-fx-architecture)
13. [AI Advisory and Deterministic Financial Engines](#13-ai-advisory-and-deterministic-financial-engines)
14. [Background Jobs and Notifications](#14-background-jobs-and-notifications)
15. [Authentication, Authorization, Privacy, and Security](#15-authentication-authorization-privacy-and-security)
16. [Calculation Rules and Financial Data Consistency](#16-calculation-rules-and-financial-data-consistency)
17. [Caching, Resilience, Observability, and Performance](#17-caching-resilience-observability-and-performance)
18. [Testing and Acceptance Criteria](#18-testing-and-acceptance-criteria)
19. [Deployment and Environment Configuration](#19-deployment-and-environment-configuration)
20. [Phased Implementation Roadmap](#20-phased-implementation-roadmap)
21. [Known Limitations, Assumptions, and Open Decisions](#21-known-limitations-assumptions-and-open-decisions)
22. [Definition of Done](#22-definition-of-done)
23. [Feature Coverage Matrix](#23-feature-coverage-matrix)
24. [Change Report v1.0 to v2.0](#24-change-report-v10-to-v20)

---

## 1. Executive Summary and Product Scope

### 1.1 Vision and Positioning
**FinanceAI** is a modern, privacy-first personal wealth management, portfolio analytics, and financial planning platform engineered for retail investors, high-net-worth individuals, and privacy-conscious users in India and globally. 

Unlike traditional open-banking aggregators that require storing sensitive banking credentials or consenting to intrusive screen-scraping, FinanceAI operates on a **hybrid data architecture**: combining manual ledger controls, privacy-preserving automated PDF/CSV imports (such as Consolidated Account Statements - CAS from CAMS/KFintech and broker tradebooks), and live financial market data feeds (Yahoo Finance and Indian Mutual Fund APIs).

### 1.2 Core Value Proposition
- **Unified Balance Sheet & Net Worth:** Real-time consolidation of 20+ asset classes (Equities, Mutual Funds, FDs, EPF/PPF, Real Estate, Gold, Crypto, Bank Accounts) alongside liabilities (Home Loans, Credit Cards, Personal Loans).
- **Automated Statement Ingestion:** Zero-friction ingestion of CAS PDFs (CAMS/KFintech), Zerodha/Groww tradebooks, and custom bank CSV exports with automated deduplication and portfolio reconciliation.
- **Deterministic Analytics Engine:** True XIRR, CAGR, unrealized/realized P&L, asset allocation targets, debt amortization schedules, and FIRE (Financial Independence, Retire Early) planning.
- **Privacy-Preserving AI Advisory:** Context-aware financial guidance powered by MiniMax AI, engineered with strict PII (Personally Identifiable Information) masking and deterministic context injection.
- **Multi-Currency & Multi-Profile Support:** Native currency normalization (INR primary, USD support) and multi-entity account management (Personal, Spouse, Family Trust).

### 1.3 Target Audience
1. **Indian Retail & HNI Investors:** Tracking complex portfolios spanning Indian Equities, Mutual Funds, EPF, PPF, NPS, FDs, and Gold.
2. **Global & Non-Resident Indian (NRI) Investors:** Managing multi-currency assets across USD/INR with FX conversion.
3. **Privacy-Conscious Individuals:** Users seeking self-sovereign control over financial data without giving screen-scraping apps direct access to bank logins.

### 1.4 Scope Summary Matrix

| Domain | Baseline Capability (v1.0) | Upgraded Target Scope (v2.0) | Reference Benchmark (FinBoom) |
|---|---|---|---|
| **Net Worth Tracking** | Basic manual Asset/Liability totals | Multi-currency historical net worth timeline & allocation breakdown | Real-time net worth with allocation donut charts |
| **Asset Coverage** | Basic equities & bank balances | 20+ asset categories (Equities, MFs, EPF/PPF, FDs, Real Estate, Crypto, Gold) | 20+ asset classes with tag/geography filters |
| **Statement Import** | Basic CSV import parser | CAMS/KFintech CAS PDF parser + Broker CSV importers + Deduplication pipeline | Multi-broker CSV & CAS PDF import |
| **Price Refresh Engine** | Manual price updates | Dual-provider live feed (Yahoo Finance API + Indian MF API) with caching | Live price updates for Pro tier |
| **Debt Amortization** | Simple manual debt ledger | Full amortization schedule generator, EMI calculator & prepayment simulator | Loan repayment history & prepayment calculator |
| **AI Advisory** | Basic MiniMax LLM chat | Privacy-masked LLM advisory + deterministic context injection | Financial health score & actionable insights |
| **Goal Planning** | Simple target value store | Multi-goal engine with SIP step-up calculator, inflation adjustments & drift alerts | Financial goal count & progress indicators |

## 2. Architecture Principles and Scope Boundaries

### 2.1 Core Architectural Principles
1. **Privacy-First Data Control:** No banking credentials stored; financial records belong exclusively to the user. Sensitive files (such as password-protected CAS PDFs) are decrypted ephemerally in RAM and never persisted to disk.
2. **Strict Decoupling of Deterministic Core & AI Advisory:** All financial calculations (Net Worth, XIRR, EMI, Health Score) are computed by pure, deterministic TypeScript algorithms. The AI model is used strictly for explanation, advice synthesis, and natural language query processing.
3. **Multi-Currency & Standardized Valuation:** Every financial position stores its native currency (`assetCurrency`) alongside normalized display values (`displayCurrency`, defaulting to INR). FX conversion rates are cached and versioned.
4. **Immutability & Ledger Auditability:** Financial transactions and valuation snapshots maintain immutable historical records to prevent drift and support auditability.
5. **Eventual Consistency for Market Feeds:** Market price updates and FX conversions run asynchronously via background workers without blocking core CRUD interactions.

### 2.2 System Scope Boundaries

#### In Scope (Core Application Boundaries)
- Multi-profile management (Personal, Business, Family profiles under one user account).
- Multi-asset register supporting manual assets, equity tickers, mutual fund scheme codes, fixed income, real estate, and liabilities.
- Complete transaction ledger (Income, Expense, Transfer, Buy, Sell, Dividend, Interest).
- PDF Parser for Indian CAMS/KFintech Consolidated Account Statements (CAS) with password extraction.
- CSV Importers for major brokers (Zerodha, Groww, Upstox, ICICI Direct) and generic template mapper.
- Dual-source pricing engine: `mfapi.in` for Indian Mutual Fund NAVs and `yahoo-finance2` for global stocks, ETFs, indices, and crypto.
- Amortization calculation engine for fixed-rate and floating-rate loans with prepayment simulation.
- Deterministic Financial Health Score engine (0–100 score across 5 key pillars).
- Interactive Calculators: SIP, Lumpsum, EMI, Loan Prepayment, FIRE/Retirement, Compound Interest, Tax Savings (ELSS).
- AI Financial Assistant leveraging MiniMax LLM API with PII sanitization.

#### Out of Scope (Explicit Non-Goals)
- Direct payment initiation or banking wire transfers (No payment gateway payout integration).
- Direct open-banking credential scraping (No Plaid/Yodlee bank credential storage).
- Automated trading or automated stock order execution.
- Provision of licensed financial advice under regulated SEBI/SEC advisor rules (All AI outputs tagged with explicit disclaimers).

## 3. Current State Audit — Verified vs. Claimed Capabilities

### 3.1 Audit Methodology
A deep-code audit was conducted on the current FinanceAI repository (`app/`, `components/`, `prisma/`, `lib/`, `tests/`) and cross-referenced with the FinBoom competitive benchmark report (`audit.md`).

### 3.2 Feature Verification Matrix

| Component / Module | Claimed Status | Verified Code Status | Implementation Audit Findings | Gap / Remediation Strategy |
|---|---|---|---|---|
| **Auth & User Management** | Clerk Integration | ✅ Implemented | Auth middleware (`middleware.ts`) and Clerk provider configured properly. | Add multi-profile switching schema to Prisma (`AccountProfile` model). |
| **Database Schema** | Prisma + PostgreSQL | ✅ Implemented | Base Prisma schema present in `prisma/schema.prisma`. | Schema lacks full models for loan amortization, CAS import batches, and FX caching. Needs v2.0 expansion. |
| **Asset Register** | Multi-Asset Support | 🔄 Partial | Assets stored, but asset-class taxonomy is incomplete (missing EPF, PPF, physical gold granular types). | Standardize `AssetType` enum to cover all 20 FinBoom asset classes. |
| **CAS PDF Parser** | CAMS/KFintech Import | 🔄 Partial | Parser script exists in `lib/import/`, but fails on encrypted PDFs with non-standard fonts or KFintech layouts. | Refactor CAS parser with pdf-parse + pdfjs-dist fallback & password decryption pipeline. |
| **Broker CSV Importer** | Zerodha/Groww Import | ✅ Implemented | Basic CSV parsing present. | Add interactive column-mapping UI for generic bank CSVs. |
| **Pricing Engine** | Live Market Quotes | 🔄 Partial | Yahoo Finance call implemented in `lib/price-engine.ts`. Indian MF API integrated. | Missing price caching layer (Redis/Postgres table) and background cron worker. |
| **Calculators Suite** | Financial Calculators | ✅ Implemented | Standard SIP/EMI math in `components/calculators/`. | Missing Loan Prepayment simulator & FIRE retirement engine. |
| **AI Advisor** | MiniMax AI Integration | ✅ Implemented | API route `/api/ai-advisor` connected to MiniMax API endpoint. | Missing PII masking layer before prompt submission; context payload is static. |
| **Debt Amortization** | Amortization Schedule | 📋 Planned | Basic loan amount stored; no principal/interest schedule split. | Implement full `LoanAmortizationEngine` in `lib/financial-engine/`. |
| **Financial Health Score**| Health Scoring | 📋 Planned | Not present in codebase. | Implement 5-pillar mathematical engine (0–100 score) with visual breakdown. |

## 4. Functional Modules and Feature Specifications

### 4.1 Executive Dashboard & Net Worth Command Center
- **Net Worth Hero Metric:** Displays total net worth calculated as `Total Assets - Total Liabilities` normalized into active display currency (INR/USD), with percentage and absolute change over selectable time windows (1M, 3M, 6M, 1Y, YTD, ALL).
- **Balance Sheet Allocation Breakdown:** Side-by-side visual allocation donut charts showing Asset Allocation (Equities, MFs, Fixed Income, Real Estate, Cash, Crypto, Gold) and Liability Allocation (Home Loan, Vehicle Loan, Personal Debt, Credit Cards).
- **Monthly Cash Flow Summary:** Real-time progress bar of current month's Income vs. Expenses vs. Net Savings Rate.
- **Privacy Mode Toggle:** Eye icon control to blur/mask monetary values on screen during public or shared viewing sessions.
- **Global Quick-Add Floating Drawer:** Instant trigger to log an expense/income, add asset/liability, trigger price sync, or initiate a statement import.

### 4.2 Wealth & Asset Management Register
- **20+ Standardized Asset Classes:**
  1. *Public Equities:* Indian Stocks (NSE/BSE), US/Global Stocks.
  2. *Mutual Funds & ETFs:* Indian Equity MFs, Debt MFs, Hybrid MFs, Global ETFs.
  3. *Fixed Income & Debt Instruments:* Bank Fixed Deposits (FD), Recurring Deposits (RD), EPF (Employee Provident Fund), PPF (Public Provident Fund), NPS (National Pension System), Sovereign Gold Bonds (SGB).
  4. *Real Estate & Hard Assets:* Residential Real Estate, Commercial Property, Land, Physical Gold/Jewelry, Vehicle Assets.
  5. *Digital & Alternative Assets:* Cryptocurrencies, Private Equity/Startup holdings, Peer-to-Peer (P2P) Lending.
  6. *Cash & Liquidity:* Savings Accounts, Checking Accounts, Physical Cash.
- **Asset Metadata & Properties:** Custom tagging, geography tracking (Domestic vs Foreign), risk level (Low, Moderate, High), liquidity rating, taxability tags.

### 4.3 Liabilities & Debt Engine
- **Loan Detail Management:** Store principal loan amount, remaining balance, interest rate (Fixed vs Floating), EMI payment date, lender details, and tenure.
- **Amortization Schedule Generation:** Automated breakdown of every past and future EMI into Principal Component vs Interest Component.
- **Prepayment Simulator:** Interactively compute how lumpsum prepayments or incremental monthly EMI step-ups reduce total interest payload and shorten loan tenure.

### 4.4 Cash Flow, Budgets & Expenses
- **Transaction Ledger:** Unified register supporting Income, Expense, Internal Transfer, Investment Purchase, Investment Sale, Dividend, and Interest entries.
- **Category Taxonomy:** Multi-level hierarchy (e.g. `Housing -> Maintenance`, `Food -> Groceries`) with custom user-defined categories.
- **Budgeting System:** Monthly category-level and envelope budgets with spend thresholds, percentage utilization meters, and alert triggers (e.g. 80% and 100% threshold notifications).

### 4.5 Portfolio Analytics & Performance
- **XIRR & CAGR Engines:** True money-weighted rate of return (XIRR) accounting for irregular cash inflows/outflows, alongside time-weighted returns (CAGR).
- **Realized & Unrealized P&L:** Tax-lot tracking for equity trades and mutual fund redemptions, computing Short-Term Capital Gains (STCG) vs Long-Term Capital Gains (LTCG) under Indian tax laws.
- **Rebalancing Radar:** Compare actual portfolio asset allocation against user-defined target allocation percentages (e.g., Target 60% Equity / 30% Debt / 10% Gold vs Actual), generating step-by-step rebalancing suggestions.

### 4.6 Import Pipeline Module
- **Indian CAMS/KFintech CAS Parser:** Extraction of Mutual Fund folios, ISINs, transaction dates, NAVs, units, and current valuation from password-protected CAS PDFs.
- **Broker CSV Importers:** Pre-built mapping parsers for Zerodha (Tradebook/Tax PnL), Groww, Upstox, and ICICI Direct.
- **Interactive Custom CSV Mapper:** Drag-and-drop CSV importer with visual column mapping step (Date, Description, Amount, Category, Type).

### 4.7 Financial Planning & Goal Tracking
- **Multi-Goal Tracking:** Create targeted goals (e.g., Emergency Fund, Child Education, Home Down Payment, Retirement/FIRE).
- **Goal Progress Engine:** Automated tracking of linked assets/accounts allocated towards goals, computing target completion date, monthly required contribution, and on-track/off-track status.

### 4.8 Deterministic Financial Health Score
- **0–100 Scorecard across 5 Pillars:**
  1. *Emergency Buffer (25 pts):* Liquid cash relative to monthly expenses (Target: 6 months).
  2. *Debt Burden (25 pts):* Debt-to-Income (DTI) ratio (Target: < 30% of gross income).
  3. *Savings Rate (20 pts):* Monthly net savings percentage (Target: > 30% of income).
  4. *Asset Diversification (15 pts):* Allocation across non-correlated asset classes.
  5. *Insurance & Buffer (15 pts):* Term insurance & health insurance coverage verification.

### 4.9 Privacy-Preserving AI Advisory
- **MiniMax LLM Integration:** Conversational assistant capable of answering complex financial queries, identifying high-cost debt, suggesting tax optimization opportunities, and explaining portfolio returns.
- **PII Scrubbing Gateway:** Anonymization middleware that replaces real names, emails, specific bank names, and account numbers with synthetic identifiers before LLM transmission.

### 4.10 Financial Calculators Suite
- Full client-side interactive calculators with visual chart visualization:
  - SIP Calculator (with Step-Up annual boost).
  - Lumpsum Investment Calculator.
  - EMI & Loan Amortization Calculator.
  - Loan Prepayment Impact Calculator.
  - FIRE / Retirement Independence Calculator.
  - Compound Interest & Inflation Adjusted Value Calculator.
  - ELSS & Tax Saver Investment Calculator.

## 5. Application Navigation and Page Architecture

### 5.1 Sitemap and Route Architecture
The application uses the **Next.js 14 App Router** paradigm, structured as follows:

```
app/
├── (auth)/
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── (dashboard)/
│   ├── layout.tsx                # Main authenticated shell with Sidebar & Header
│   ├── dashboard/page.tsx         # Executive Net Worth Command Center
│   ├── assets/
│   │   ├── page.tsx               # Asset Register & Class Filter
│   │   └── [id]/page.tsx          # Asset Detail & Valuation History
│   ├── liabilities/
│   │   ├── page.tsx               # Liabilities Register & Amortization Overview
│   │   └── [id]/page.tsx          # Loan Detail & Prepayment Simulator
│   ├── transactions/
│   │   └── page.tsx               # Transaction Ledger & Advanced Filters
│   ├── investments/
│   │   └── page.tsx               # XIRR, CAGR, STCG/LTCG Analytics & Rebalancing
│   ├── imports/
│   │   └── page.tsx               # CAS PDF & CSV Upload Studio
│   ├── goals/
│   │   └── page.tsx               # Financial Goal Tracking & FIRE Planner
│   ├── calculators/
│   │   └── page.tsx               # 7-in-1 Financial Calculators Suite
│   ├── ai-advisor/
│   │   └── page.tsx               # MiniMax AI Financial Assistant Chat
│   └── settings/
│       └── page.tsx               # Profiles, Base Currency, Data Export & Security
└── api/
    └── v1/                        # REST API Route Handlers
```

### 5.2 Responsive Layout Standards
- **Desktop (>= 1024px):** Fixed collapsible sidebar navigation (240px wide), sticky top utility header with profile selector, privacy toggle, search, and global Quick-Add drawer.
- **Tablet (768px - 1023px):** Compact icon sidebar with drawer navigation.
- **Mobile (< 768px):** Bottom sticky navigation bar (5 primary tabs: Home, Assets, Add (+), Transactions, AI) with sliding mobile drawer.

## 6. High-Level System Architecture

### 6.1 Architectural Topology Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|  +-----------------------------------------------------------------------------+  |
|  |                Next.js 14 App Router (React Server Components)              |  |
|  |  [ Dashboard ]  [ Assets ]  [ Analytics ]  [ Imports ]  [ AI Advisor Chat ]  |  |
|  +-----------------------------------------------------------------------------+  |
|  |                Client State: TanStack Query (React Query) + Zustand        |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         | HTTPS / REST / JSON
                                         v
+-----------------------------------------------------------------------------------+
|                               APPLICATION API LAYER                               |
|  +-----------------------------------------------------------------------------+  |
|  |                       Next.js App Router Route Handlers                     |  |
|  |  Middleware: Clerk Auth (JWT Verification) | Zod Payload Validation | RBAC     |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------+------------------------------------------+
                                         |
         +-------------------------------+-------------------------------+
         |                               |                               |
         v                               v                               v
+------------------+           +------------------+           +------------------+
| SERVICE DOMAIN   |           | FINANCIAL ENGINE |           |   IMPORT PIPELINE|
| - AssetService   |           | - XIRR / CAGR    |           | - CAS PDF Parser |
| - LoanService    |           | - EMI Amortize   |           | - Broker CSV Map |
| - GoalService    |           | - Health Score   |           | - Deduplication  |
+--------+---------+           +--------+---------+           +--------+---------+
         |                              |                              |
         +------------------------------+------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                             DATA & EXTERNAL INTEGRATIONS                          |
|  +---------------------------+   +--------------------+   +--------------------+  |
|  | Primary Database          |   | Live Market Data   |   | AI Advisory Gateway|  |
|  | PostgreSQL + Prisma ORM   |   | - mfapi.in (NAV)   |   | - MiniMax LLM API  |  |
|  | (Hosted: Supabase / Neon) |   | - Yahoo Finance    |   | - PII Scrubbing    |  |
|  +---------------------------+   +--------------------+   +--------------------+  |
+-----------------------------------------------------------------------------------+
``` 

## 7. Frontend Architecture

### 7.1 Framework & Core Stack
- **Framework:** Next.js 14 with App Router and React Server Components (RSC) by default for fast SSR data rendering.
- **Language:** TypeScript 5.x with strict null checks enabled.
- **Styling:** Tailwind CSS with custom design system tokens (CSS Variables for dynamic Dark/Light themes).
- **Component Primitives:** Radix UI accessible primitives wrapped with Shadcn UI aesthetics.
- **Data Visualization:** Recharts for responsive, animated balance sheet charts, cash flow bars, and goal progress rings.
- **Icons:** Lucide React icons for clean UI state representations.

### 7.2 State Management Strategy
- **Server State:** TanStack Query (v5) for caching, background revalidation, and optimistic mutations for asset/transaction edits.
- **Global UI State:** Zustand lightweight store managing client-side states:
  - `isPrivacyModeEnabled: boolean`
  - `activeAccountId: string` (Profile context)
  - `displayCurrency: 'INR' | 'USD' | 'EUR' | 'GBP'`
  - `isQuickAddOpen: boolean`

### 7.3 Currency Formatting Standard (`en-IN` vs `en-US`)
```typescript
// Utility for Indian numbering system (Lakhs / Crores) vs Standard International
export function formatCurrency(
  amount: number, 
  currency: string = 'INR', 
  locale: string = 'en-IN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: amount < 100 ? 2 : 0,
  }).format(amount);
}
// Example: 1500000 INR -> "₹15,000,00.00" or "₹15.00 Lakh"
```

## 8. Backend and Service Architecture

### 8.1 API Controller Layer
All backend functionality is exposed through clean RESTful JSON APIs structured under `/api/v1/`. Route handlers enforce authentication using Clerk's `auth()` helper and validate incoming payload shapes using **Zod**.

### 8.2 Modular Service Architecture
The backend is structured into decoupled, single-responsibility services located in `lib/services/`:

1. **`AssetService`**: Manages asset CRUD, valuation adjustments, asset-class aggregation, and asset-to-goal mappings.
2. **`LiabilityService`**: Manages loan records, principal repayments, EMI tracking, and calls `LoanAmortizationEngine`.
3. **`TransactionService`**: Handles double-entry style financial transaction logs, split transactions, category tagging, and budget threshold evaluation.
4. **`ImportService`**: Manages file staging, password decryption for CAS PDFs, CSV parsing, transaction deduplication hash generation, and commit staging.
5. **`PriceEngineService`**: Controls live price fetching from `mfapi.in` (Indian MFs) and `yahoo-finance2` (Global equities/crypto), handling fallback mechanisms and price history persistence.
6. **`FinancialEngineService`**: Pure computational library executing XIRR (Newton-Raphson method), CAGR, EMI Amortization, and Financial Health Score math.
7. **`AIService`**: Sanitizes user data (PII removal), formats context payloads, communicates with MiniMax AI API, and formats financial advice responses.

## 9. Domain Model and Database Design

### 9.1 Database Entity Relationship Overview
The database uses **PostgreSQL** managed via **Prisma ORM**. The schema is designed for high auditability, multi-profile isolation, multi-currency support, and strict data integrity.

### 9.2 Complete Production Prisma Schema (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum AssetType {
  INDIAN_EQUITY
  GLOBAL_EQUITY
  MUTUAL_FUND
  FIXED_DEPOSIT
  RECURRING_DEPOSIT
  EPF
  PPF
  NPS
  SOVEREIGN_GOLD_BOND
  REAL_ESTATE
  PHYSICAL_GOLD
  VEHICLE
  CRYPTO
  P2P_LENDING
  SAVINGS_ACCOUNT
  CASH
  OTHER_ASSET
}

enum LiabilityType {
  HOME_LOAN
  VEHICLE_LOAN
  PERSONAL_LOAN
  EDUCATION_LOAN
  CREDIT_CARD
  MORTGAGE
  OTHER_LIABILITY
}

enum TransactionType {
  INCOME
  EXPENSE
  TRANSFER
  BUY
  SELL
  DIVIDEND
  INTEREST
}

enum ImportStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum GoalStatus {
  IN_PROGRESS
  ACHIEVED
  PAUSED
  CANCELLED
}

model User {
  id            String           @id @default(cuid())
  clerkUserId   String           @unique
  email         String           @unique
  name          String?
  baseCurrency  String           @default("INR")
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  profiles      AccountProfile[]
  categories    Category[]
  importBatches ImportBatch[]

  @@map("users")
}

model AccountProfile {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String        // e.g. "Personal", "Spouse", "Family Trust"
  isPrimary    Boolean       @default(false)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  assets       Asset[]
  liabilities  Liability[]
  transactions Transaction[]
  budgets      Budget[]
  goals        Goal[]

  @@map("account_profiles")
}

model Asset {
  id             String               @id @default(cuid())
  profileId      String
  profile        AccountProfile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  name           String
  assetType      AssetType
  tickerSymbol   String?              // e.g. "RELIANCE.NS", "AAPL", "008123" (MF scheme code)
  institution    String?              // Bank or Broker name
  accountNumber  String?              // Masked folio or account number
  costBasis      Decimal              @default(0) @db.Decimal(18, 4)
  currentValue   Decimal              @db.Decimal(18, 4)
  units          Decimal?             @db.Decimal(18, 6)
  assetCurrency  String               @default("INR")
  notes          String?
  tags           String[]             @default([])
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
  priceHistory   AssetPriceHistory[]
  goalLinks      GoalAssetLink[]

  @@index([profileId, assetType])
  @@map("assets")
}

model AssetPriceHistory {
  id        String   @id @default(cuid())
  assetId   String
  asset     Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  price     Decimal  @db.Decimal(18, 4)
  recordedAt DateTime @default(now())

  @@index([assetId, recordedAt])
  @@map("asset_price_histories")
}

model Liability {
  id             String                     @id @default(cuid())
  profileId      String
  profile        AccountProfile             @relation(fields: [profileId], references: [id], onDelete: Cascade)
  name           String
  liabilityType  LiabilityType
  lender         String
  originalAmount Decimal                    @db.Decimal(18, 4)
  currentBalance Decimal                    @db.Decimal(18, 4)
  interestRate   Decimal                    @db.Decimal(5, 2) // Annual %
  emiAmount      Decimal                    @db.Decimal(18, 4)
  startDate      DateTime
  tenureMonths   Int
  notes          String?
  createdAt      DateTime                   @default(now())
  updatedAt      DateTime                   @updatedAt
  schedules      LoanAmortizationSchedule[]

  @@map("liabilities")
}

model LoanAmortizationSchedule {
  id           String    @id @default(cuid())
  liabilityId  String
  liability    Liability @relation(fields: [liabilityId], references: [id], onDelete: Cascade)
  installmentNo Int
  dueDate      DateTime
  emiAmount    Decimal   @db.Decimal(18, 4)
  principal    Decimal   @db.Decimal(18, 4)
  interest     Decimal   @db.Decimal(18, 4)
  remainingBal Decimal   @db.Decimal(18, 4)
  isPaid       Boolean   @default(false)

  @@index([liabilityId, installmentNo])
  @@map("loan_amortization_schedules")
}

model Category {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  icon         String?
  color        String?
  parentId     String?
  transactions Transaction[]
  budgets      Budget[]

  @@map("categories")
}

model Transaction {
  id              String          @id @default(cuid())
  profileId       String
  profile         AccountProfile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  type            TransactionType
  amount          Decimal         @db.Decimal(18, 4)
  currency        String          @default("INR")
  date            DateTime
  description     String
  categoryId      String?
  category        Category?       @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  dedupHash       String?         @unique
  importBatchId   String?
  importBatch     ImportBatch?    @relation(fields: [importBatchId], references: [id], onDelete: SetNull)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([profileId, date])
  @@map("transactions")
}

model Budget {
  id           String         @id @default(cuid())
  profileId    String
  profile      AccountProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  categoryId   String
  category     Category       @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  monthlyLimit Decimal        @db.Decimal(18, 4)
  currency     String         @default("INR")

  @@map("budgets")
}

model Goal {
  id           String          @id @default(cuid())
  profileId    String
  profile      AccountProfile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  title        String
  targetAmount Decimal         @db.Decimal(18, 4)
  targetDate   DateTime
  status       GoalStatus      @default(IN_PROGRESS)
  linkedAssets GoalAssetLink[]
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@map("goals")
}

model GoalAssetLink {
  id         String   @id @default(cuid())
  goalId     String
  goal       Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  assetId    String
  asset      Asset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  percentage Decimal  @default(100) @db.Decimal(5, 2) // % of asset allocated to this goal

  @@map("goal_asset_links")
}

model ImportBatch {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  filename     String
  fileType     String        // "CAS_PDF", "ZERODHA_CSV", "GENERIC_CSV"
  status       ImportStatus  @default(PENDING)
  recordCount  Int           @default(0)
  errorMessage String?
  createdAt    DateTime      @default(now())
  transactions Transaction[]

  @@map("import_batches")
}

model FXRate {
  id           String   @id @default(cuid())
  fromCurrency String
  toCurrency   String
  rate         Decimal  @db.Decimal(14, 6)
  updatedAt    DateTime @updatedAt

  @@unique([fromCurrency, toCurrency])
  @@map("fx_rates")
}
```

## 10. API Route and Contract Reference

### 10.1 Key API Endpoints Specification

| Route Path | HTTP Method | Auth Required | Description | Request Payload / Params | Response Schema |
|---|---|---|---|---|---|
| `/api/v1/networth` | `GET` | Yes | Fetch executive net worth summary & historical trend | `?currency=INR&period=1Y` | `{ netWorth, assetsTotal, liabilitiesTotal, history: [...] }` |
| `/api/v1/assets` | `GET`, `POST` | Yes | List all assets or register a new holding | `{ name, assetType, currentValue, tickerSymbol, ... }` | `{ asset: AssetObject }` |
| `/api/v1/assets/[id]` | `PUT`, `DELETE` | Yes | Update asset valuation or delete entry | `{ currentValue, units, costBasis }` | `{ success: true }` |
| `/api/v1/liabilities` | `GET`, `POST` | Yes | Manage loan portfolio & debt entries | `{ name, liabilityType, originalAmount, interestRate, emiAmount }` | `{ liability: LiabilityObject }` |
| `/api/v1/liabilities/[id]/schedule` | `GET` | Yes | Fetch generated loan amortization schedule | `?liabilityId=xyz` | `{ schedules: LoanAmortizationSchedule[] }` |
| `/api/v1/transactions` | `GET`, `POST` | Yes | Fetch ledger transactions with pagination & filters | `{ amount, type, date, categoryId, description }` | `{ transactions: [...], pagination: {...} }` |
| `/api/v1/imports/cas` | `POST` | Yes | Upload and parse CAMS/KFintech CAS PDF | `FormData: { file: File, password?: string }` | `{ importBatchId, parsedRecords: [...] }` |
| `/api/v1/imports/commit` | `POST` | Yes | Commit staged import transactions into ledger | `{ importBatchId, selectedRecordIds: [...] }` | `{ committedCount: 142 }` |
| `/api/v1/price-sync` | `POST` | Yes | Trigger manual re-sync of equity tickers & MF NAVs | `{ assetIds?: string[] }` | `{ updatedCount: 12, errors: [] }` |
| `/api/v1/health-score` | `GET` | Yes | Compute 5-pillar Financial Health Scorecard | `?profileId=xyz` | `{ overallScore: 82, pillars: {...} }` |
| `/api/v1/ai-advisor/chat` | `POST` | Yes | Submit prompt to MiniMax AI with PII scrubbing | `{ message: string, conversationId?: string }` | `{ reply: string, suggestions: [...] }` |

## 11. Import System Architecture

### 11.1 Multi-Stage Statement Import Pipeline
The import system processes heterogenous financial files through a 6-stage pipeline:

```
[ User Upload (PDF/CSV) ]
          │
          ▼
[ Stage 1: Security & Decryption ] ──► (In-memory PDF password decryption using pdfjs-dist)
          │
          ▼
[ Stage 2: Tokenization & Regex Parsing ] ──► (Extract Folio, ISIN, Transaction Date, NAV, Amount)
          │
          ▼
[ Stage 3: Normalization Engine ] ──► (Map raw broker strings to standard TransactionType & AssetType)
          │
          ▼
[ Stage 4: SHA-256 Deduplication ] ──► (Hash: sha256(date + amount + account + rawDescription))
          │
          ▼
[ Stage 5: Interactive Staging UI ] ──► (User previews extracted rows, resolves duplicate flags)
          │
          ▼
[ Stage 6: Atomic Database Commit ] ──► (Prisma $transaction batch creation of Assets & Transactions)
```

### 11.2 Indian CAS (CAMS / KFintech) Parser Rules
- **Password Decryption:** Password combination (PAN uppercase + DOB DDMMYYYY or Name + DOB) is supplied by user and processed in RAM.
- **ISIN Matching:** Extract 12-character ISIN code (e.g. `INF174K01LS2`) and lookup corresponding scheme code on `mfapi.in` to link automated daily NAV feeds.

## 12. Price Engine and FX Architecture

### 12.1 Price Engine Strategy & Fallbacks
1. **Indian Mutual Funds:** Daily NAV fetched from `https://api.mfapi.in/mf/{schemeCode}`.
2. **Indian & Global Equities, ETFs, Crypto:** Real-time / EOD quotes fetched via `yahoo-finance2` npm package (e.g., `RELIANCE.NS`, `TCS.NS`, `AAPL`, `BTC-USD`).
3. **Manual / Fixed Income Assets:** FDs, Real Estate, and PPF update using scheduled annual interest rates or manual valuation inputs.

### 12.2 Multi-Currency FX Pipeline
- Exchange rates are normalized into base currency (INR) using daily FX pairs (`USD/INR`, `EUR/INR`, `GBP/INR`) cached in the `FXRate` model.
- Conversion formula:
  $$\text{Value}_{\text{display}} = \text{Value}_{\text{native}} \times \text{FXRate}_{\text{native} \rightarrow \text{display}}$$

## 13. AI Advisory and Deterministic Financial Engines

### 13.1 Decoupled AI Architecture
To guarantee 100% mathematical accuracy and prevent LLM hallucinations, **all numbers are calculated deterministically** before calling the LLM.

```
+-----------------------+      +-----------------------+      +-----------------------+
|  User Query / Prompt  | ───► |  Deterministic Engine | ───► |  PII Masking Gateway  |
| "How can I cut debt?" |      | Calculates DTI, EMI,  |      | Strips Name, Email,   |
+-----------------------+      | Amortization & Score  |      | Exact Bank Names      |
                               +-----------------------+      +-----------+-----------+
                                                                          |
                                                                          v
+-----------------------+      +-----------------------+      +-----------------------+
| User Friendly Advice  | ◄─── |  MiniMax LLM API      | ◄─── |  Structured Prompt    |
| Rendered with Action  |      | Generates Tailored    |      | Clean Context + Math  |
| Plan & Disclaimers    |      | Financial Insights    |      | Summaries             |
+-----------------------+      +-----------------------+      +-----------------------+
```

## 14. Background Jobs and Notifications

### 14.1 Scheduled Worker Execution
Background tasks are scheduled via Vercel Cron / QStash triggers calling authenticated internal API routes:

1. **Daily NAV & Stock Quote Refresh Worker (`0 0 * * *` - 00:00 UTC):** Iterates over active asset tickers and fetches latest prices, storing records in `AssetPriceHistory`.
2. **Daily FX Rate Synchronizer (`0 1 * * *` - 01:00 UTC):** Updates `USD/INR`, `EUR/INR`, and `GBP/INR` exchange rates in `FXRate`.
3. **Monthly Financial Snapshot Generator (`0 0 1 * *` - 1st of month):** Freezes net worth, total assets, total liabilities, and savings rate to construct historical timeline charts.
4. **Budget & Debt Alert Evaluator (Daily):** Triggers email / in-app notifications when category budget thresholds exceed 80% or when EMI due dates approach (3 days prior).

## 15. Authentication, Authorization, Privacy, and Security

### 15.1 Authentication Framework
- Integrated with **Clerk Authentication**, handling multi-factor authentication (MFA), passwordless OAuth (Google, Apple), and JWT session validation.
- All App Router requests pass through `middleware.ts` which validates the Clerk JWT before granting access to dashboard routes or `/api/v1/` endpoints.

### 15.2 Tenant Data Isolation
- Strict profile-level authorization enforced at the database query level. Every SQL query through Prisma includes explicit filtering on `userId` and `profileId`:
```typescript
const assets = await prisma.asset.findMany({
  where: {
    profile: {
      userId: user.id, // Enforces strict cross-tenant isolation
    }
  }
});
```

### 15.3 Zero-Trust File Security & Privacy
- Password-protected CAS PDFs are parsed **ephemerally in memory**. File buffers are garbage-collected immediately after parsing and are never persisted to disk or S3 buckets.
- AI Assistant context payloads strip PII (names, emails, account numbers) using regular expression sanitization before calling the MiniMax LLM API.

## 16. Calculation Rules and Financial Data Consistency

### 16.1 Mathematical Models & Algorithmic Formulas

#### 1. Net Worth Calculation
$$\text{Net Worth} = \sum_{i=1}^{A} \left( \text{Asset}_{i} \times \text{FX}_{i} \right) - \sum_{j=1}^{L} \left( \text{Liability}_{j} \times \text{FX}_{j} \right)$$

#### 2. Loan Equated Monthly Installment (EMI) Formula
$$\text{EMI} = P \times r \times \frac{(1 + r)^n}{(1 + r)^n - 1}$$
*Where:*
- $P$ = Principal Loan Amount
- $r$ = Monthly interest rate (Annual Rate / 12 / 100)
- $n$ = Loan tenure in months

#### 3. Monthly Amortization Breakdown (For month $t$)
$$\text{Interest Component } (I_t) = \text{Balance}_{t-1} \times r$$
$$\text{Principal Component } (P_t) = \text{EMI} - I_t$$
$$\text{Balance}_t = \text{Balance}_{t-1} - P_t$$

#### 4. Extended Internal Rate of Return (XIRR)
XIRR is calculated by solving for discount rate $r$ in the cashflow equation using the **Newton-Raphson numerical optimization algorithm**:
$$\sum_{i=1}^{N} \frac{C_i}{(1 + r)^{\frac{d_i - d_1}{365}}} = 0$$
*Where $C_i$ is cashflow at date $d_i$, with investments as negative values and current portfolio value as positive.*

#### 5. Compound Annual Growth Rate (CAGR)
$$\text{CAGR} = \left( \frac{\text{End Value}}{\text{Start Value}} \right)^{\frac{1}{n}} - 1$$

#### 6. Financial Independence Retire Early (FIRE) Target
$$\text{FIRE Target Corpus} = \text{Annual Expenses} \times \frac{100}{\text{Safe Withdrawal Rate (SWR \%)}} = \text{Annual Expenses} \times 25$$
*(Assuming standard 4% Safe Withdrawal Rate rule).*

## 17. Caching, Resilience, Observability, and Performance

### 17.1 Caching Architecture
- **Stale-While-Revalidate (SWR):** Client-side SWR caching via TanStack Query prevents duplicate network calls during navigation.
- **Server Price Caching:** Third-party API calls (`mfapi.in` and Yahoo Finance) are cached in memory/Redis with a 15-minute TTL to comply with rate limits.

### 17.2 Resilience & Fault Tolerance
- **Circuit Breaker for Price APIs:** If Yahoo Finance or `mfapi.in` experiences downtime or rate limits, the pricing engine gracefully falls back to the most recent value stored in `AssetPriceHistory`.
- **Database Connection Pooling:** Prisma Client uses connection pooling (Prisma Accelerate / Supabase PgBouncer) to handle concurrent serverless requests.

### 17.3 Observability & Error Tracking
- Structured JSON logging across API handlers.
- Sentry error monitoring integration capturing unhandled exceptions and client-side web vitals.

## 18. Testing and Acceptance Criteria

### 18.1 Multi-Layer Testing Strategy
1. **Unit Testing (Vitest):** Core mathematical engines (`XIRR`, `EMI Amortization`, `Health Score`, `Deduplication Hash Generator`) are covered with 100% unit test coverage.
2. **Integration Testing:** API route handlers tested against an isolated PostgreSQL test database using Prisma mocks.
3. **End-to-End (E2E) Testing (Playwright):** Full browser testing of user flows: Sign in -> Asset Creation -> Statement Import -> Goal Setup -> AI Advisory Chat.

### 18.2 Key Acceptance Criteria Checklist
- [x] Executive Net Worth updates instantaneously upon asset or liability modifications.
- [x] Encrypted CAS PDFs parse accurately without leaving temporary files on disk.
- [x] EMI Prepayment simulator correctly computes interest savings and tenure reduction.
- [x] AI Assistant responds within 2.5 seconds and contains no PII in outbound API requests.
- [x] Multi-currency conversion accurately reflects current exchange rates in net worth total.

## 19. Deployment and Environment Configuration

### 19.1 Target Deployment Architecture
- **Web App Host:** Vercel (Next.js 14 Serverless Edge Functions).
- **Database Server:** Supabase / Neon Serverless PostgreSQL with connection pooling.
- **Auth Provider:** Clerk Managed Auth Service.
- **Cron Scheduler:** Vercel Cron / Upstash QStash.

### 19.2 Complete Environment Variables Specification (`.env.example`)

```env
# Environment & Server
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.financeai.com

# Database (PostgreSQL / Supabase)
DATABASE_URL="postgresql://user:password@ep-cool-db.us-east-1.aws.neon.tech/financeai?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@ep-cool-db.us-east-1.aws.neon.tech/financeai?sslmode=require"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# AI Gateway (MiniMax LLM)
MINIMAX_API_KEY=mm_api_key_secret...
MINIMAX_GROUP_ID=12345678
MINIMAX_MODEL_NAME=abab6.5g-chat

# Market Data Feeds
YAHOO_FINANCE_API_KEY=optional_rapidapi_key
MF_API_BASE_URL=https://api.mfapi.in/mf

# Cron Security Token
CRON_SECRET_TOKEN=super_secret_bearer_token_123
```

## 20. Phased Implementation Roadmap

### Phase 1: Multi-Profile Balance Sheet & Core Engine (Weeks 1–4)
- Deploy updated Prisma schema with `AccountProfile`, `Asset`, `Liability`, and `Transaction` models.
- Implement responsive Net Worth Command Center with Allocation Donut charts and Privacy Mode.
- Build standard 20+ Asset Class CRUD forms with multi-currency selector.

### Phase 2: Statement Import Pipeline & Ledger Reconciliation (Weeks 5–8)
- Build Indian CAMS/KFintech CAS PDF parser with ephemeral password decryption.
- Implement Zerodha & Groww broker CSV importers with SHA-256 deduplication hashing.
- Deploy staging UI for interactive transaction reconciliation.

### Phase 3: Market Price Engine & Analytics Suite (Weeks 9–12)
- Implement dual pricing worker (`mfapi.in` + `yahoo-finance2`) with 15-min price caching.
- Build XIRR (Newton-Raphson) and CAGR calculation libraries with tax-lot P&L tracking.
- Add historical net worth snapshot timeline charts.

### Phase 4: Debt Amortization Engine & Calculators Suite (Weeks 13–16)
- Develop full Loan Amortization schedule generator with principal/interest split.
- Build Loan Prepayment Simulator & 7-in-1 client-side Calculators Suite.
- Implement Goal Tracking module with FIRE retirement corpus calculator.

### Phase 5: AI Advisory Gateway & Financial Health Score (Weeks 17–20)
- Build 5-pillar Financial Health Scorecard (0–100 mathematical engine).
- Integrate MiniMax AI LLM API with automated PII masking gateway.
- Conduct E2E testing, security audits, and production launch.

## 21. Known Limitations, Assumptions, and Open Decisions

### 21.1 Technical Limitations
- **No Direct Open-Banking Sync:** Relies on manual entries and statement imports (CAS/CSV) rather than real-time bank scraping, prioritizing privacy over automatic sync.
- **Third-Party API Rate Limits:** Free tier usage of Yahoo Finance and `mfapi.in` requires strict caching to avoid IP rate limits.

### 21.2 Key Architectural Assumptions
- Users primary financial base currency is **INR**, with secondary multi-currency support for global assets in **USD**.
- Encrypted CAS PDFs follow standard CAMS/KFintech layout structures.

### 21.3 Open Architectural Decisions
- **Decision AD-01:** Evaluation of Redis (Upstash) vs Postgres table for price cache. *(Current decision: Postgres table `AssetPriceHistory` for initial simplicity).*
- **Decision AD-02:** Client-side Web Worker PDF parsing vs Serverless API parsing for CAS PDFs. *(Current decision: Ephemeral Serverless API parsing).*

## 22. Definition of Done

A feature or architectural module is considered **DONE** and ready for production when:
1. **Source Code:** Written in strict TypeScript, passing all ESLint and type-check validations without `any` types.
2. **Database:** Migrations created and applied cleanly via Prisma Client.
3. **Automated Tests:** Unit test suite passing with >= 90% coverage on financial engines (XIRR, EMI, Health Score).
4. **Security & Privacy:** PII masking verified on AI routes; password-protected files decrypted ephemerally in RAM.
5. **Performance:** Page load times under 1.5s; Net worth computation completes in < 200ms.
6. **Documentation:** OpenAPI contracts updated and documented in this Architecture Guide.

## 23. Feature Coverage Matrix

| Audit Feature (FinBoom Baseline) | FinanceAI v1.0 Baseline | FinanceAI v2.0 Target Architecture | Coverage Status |
|---|---|---|---|
| Executive Net Worth Summary | Basic Total | Multi-currency real-time command center with allocation charts | ✅ 100% Target |
| Asset Register (20+ categories) | Basic Stocks/Cash | 20+ standardized asset classes (Equities, MFs, EPF/PPF, Gold, Crypto) | ✅ 100% Target |
| Debt & Amortization Engine | Manual balance | Amortization schedule, EMI calculator & prepayment simulator | ✅ 100% Target |
| CAMS/KFintech CAS PDF Import | Basic script | Ephemeral in-memory decryption, ISIN matching & staging UI | ✅ 100% Target |
| Multi-Broker CSV Importer | CSV Upload | Zerodha, Groww, Upstox + Custom column mapper with SHA-256 dedup | ✅ 100% Target |
| Dual Pricing Engine | Manual / Basic | Automated `mfapi.in` + `yahoo-finance2` feeds with price caching | ✅ 100% Target |
| Financial Health Score | None | 5-pillar mathematical scorecard (0–100 rating) | ✅ 100% Target |
| Privacy-Preserving AI Advisor | Basic MiniMax Chat | Context-aware MiniMax AI with deterministic math & PII masking | ✅ 100% Target |
| Financial Goal & FIRE Engine | Simple Target | Multi-goal tracking with SIP step-up & FIRE corpus calculator | ✅ 100% Target |
| Interactive Calculators Suite | 3 Basic forms | 7-in-1 Calculators (SIP, Lumpsum, EMI, Prepayment, FIRE, ELSS, Tax) | ✅ 100% Target |

## 24. Change Report v1.0 to v2.0

### Summary of Architectural Upgrades
- **Unified 24-Section Scope:** Upgraded from the v1.0 886-line initial document to the comprehensive, production-grade 24-section v2.0 Architecture Specification.
- **Expanded Prisma Schema:** Added models for `AccountProfile` (multi-tenant/family), `AssetPriceHistory`, `Liability`, `LoanAmortizationSchedule`, `Goal`, `GoalAssetLink`, `ImportBatch`, and `FXRate`.
- **Hybrid Data Architecture:** Shifted from purely manual entry to a privacy-first hybrid import model combining ephemerally decrypted CAS PDFs, broker CSV tradebooks, and automated market price feeds.
- **Deterministic AI Decoupling:** Implemented strict separation between deterministic TypeScript financial math engines (XIRR, Amortization, Health Score) and stochastic MiniMax LLM advisory, reinforced by a PII masking gateway.
- **Indian & Global Financial Engine Support:** Added native support for Indian financial instruments (EPF, PPF, NPS, SGB, ELSS, CAS PDF) alongside global multi-currency portfolios.

