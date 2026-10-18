# FinanceAI — Comprehensive Product and Technical Architecture
**Document Version:** 2.3 (Final Architecture Reconciliation)  
**Status:** Approved Master Engineering Architecture & Implementation Blueprint  
**Reference Baseline:** FinanceAI Architecture v2.0 (Completeness Reference) & v2.2 (Correction Baseline)  
**Target Platform:** Next.js 14 (App Router) • TypeScript 5.x • PostgreSQL • Prisma ORM • Tailwind CSS • Clerk Auth • MiniMax AI  
**Author:** Principal Fintech Architect & Systems Engineering Team  
**Date:** October 2026  

---

## Table of Contents
1. [Executive Summary and Product Scope](#1-executive-summary-and-product-scope)
   - 1.1 [Vision and Positioning](#11-vision-and-positioning)
   - 1.2 [Core Value Proposition](#12-core-value-proposition)
   - 1.3 [Target Audience and User Personas](#13-target-audience-and-user-personas)
   - 1.4 [Complete Scope Summary Matrix](#14-complete-scope-summary-matrix)
2. [Architecture Principles and Scope Boundaries](#2-architecture-principles-and-scope-boundaries)
   - 2.1 [Core Architectural Principles](#21-core-architectural-principles)
   - 2.2 [System Scope Boundaries (In-Scope vs. Explicit Non-Goals)](#22-system-scope-boundaries)
3. [Verified Current State Audit vs. Benchmark Capabilities](#3-verified-current-state-audit-vs-benchmark-capabilities)
   - 3.1 [Audit Methodology & Codebase Ground Truth](#31-audit-methodology--codebase-ground-truth)
   - 3.2 [Verified Code State vs. FinBoom Benchmark Matrix](#32-verified-code-state-vs-finboom-benchmark-matrix)
   - 3.3 [Broker Import Capability Audit (Groww & INDmoney Asset-by-Asset Audit)](#33-broker-import-capability-audit)
4. [Comprehensive Feature Register](#4-comprehensive-feature-register)
   - 4.1 [Classification Taxonomy (Benchmark Observed, Inferred, Original, Enhancement)](#41-classification-taxonomy)
   - 4.2 [Master Feature Register Table](#42-master-feature-register-table)
5. [Functional Modules and Feature Specifications](#5-functional-modules-and-feature-specifications)
   - 5.1 [Executive Dashboard & Net Worth Command Center](#51-executive-dashboard--net-worth-command-center)
   - 5.2 [Wealth & Asset Management Register (20+ Standard Asset Classes)](#52-wealth--asset-management-register)
   - 5.3 [Liabilities, Loans & Debt Engine](#53-liabilities-loans--debt-engine)
   - 5.4 [Cash Flow, Accounts & Multi-Currency Ledger](#54-cash-flow-accounts--multi-currency-ledger)
   - 5.5 [Portfolio Analytics, Allocation & Performance (XIRR, CAGR)](#55-portfolio-analytics-allocation--performance)
   - 5.6 [Multi-Broker Import Pipeline (Staging, Deduplication, Reconciliation)](#56-multi-broker-import-pipeline)
   - 5.7 [Financial Planning, Goals & FIRE Tracking](#57-financial-planning-goals--fire-tracking)
   - 5.8 [Deterministic Financial Health Score Engine](#58-deterministic-financial-health-score-engine)
   - 5.9 [Privacy-Preserving AI Advisory Gateway](#59-privacy-preserving-ai-advisory-gateway)
   - 5.10 [Financial Calculators Suite](#510-financial-calculators-suite)
6. [Application Navigation and Page Architecture](#6-application-navigation-and-page-architecture)
   - 6.1 [Complete Sitemap and Route Architecture (Next.js 14 App Router)](#61-complete-sitemap-and-route-architecture)
   - 6.2 [Responsive Layout Standards & Component Design System](#62-responsive-layout-standards)
7. [High-Level System Architecture and Topology](#7-high-level-system-architecture-and-topology)
   - 7.1 [Architectural Topology Diagram](#71-architectural-topology-diagram)
   - 7.2 [Data Flow Architecture & Service Boundaries](#72-data-flow-architecture)
8. [Frontend Architecture & Design System](#8-frontend-architecture--design-system)
   - 8.1 [Framework & Core Stack](#81-framework--core-stack)
   - 8.2 [State Management Strategy (Server vs. Client State)](#82-state-management-strategy)
   - 8.3 [Currency Formatting Standard (`en-IN` vs. `en-US`)](#83-currency-formatting-standard)
   - 8.4 [Component Hierarchy & Design Tokens](#84-component-hierarchy--design-tokens)
9. [Backend and Service Architecture](#9-backend-and-service-architecture)
   - 9.1 [API Controller Layer & Middleware](#91-api-controller-layer--middleware)
   - 9.2 [Modular Service Architecture & Ownership Matrix](#92-modular-service-architecture)
10. [Target Domain Model, Schema Specification, and Migration Strategy](#10-target-domain-model-schema-specification-and-migration-strategy)
    - 10.1 [Database Entity Relationship Architecture](#101-database-entity-relationship-architecture)
    - 10.2 [Complete Production Target Prisma Schema (`prisma/schema.prisma`)](#102-complete-production-target-prisma-schema)
    - 10.3 [Schema Migration, Backfill, Compatibility, and Recovery Plan](#103-schema-migration-backfill-compatibility-and-recovery-plan)
    - 10.4 [Compound Uniqueness, Deduplication Scoping, and Transfer Pairing](#104-compound-uniqueness-deduplication-scoping-and-transfer-pairing)
11. [API Route and Service Contract Reference](#11-api-route-and-service-contract-reference)
    - 11.1 [Complete RESTful API Specifications & Payload Schemas](#111-complete-restful-api-specifications)
12. [Import Pipeline and Broker Format Engine](#12-import-pipeline-and-broker-format-engine)
    - 12.1 [6-Stage Ephemeral Import Pipeline](#121-6-stage-ephemeral-import-pipeline)
    - 12.2 [Indian CAS (CAMS / KFintech) Parser Rules & Ephemeral Decryption](#122-indian-cas-cams--kfintech-parser-rules)
    - 12.3 [Groww and INDmoney Adapter Execution Rules](#123-groww-and-indmoney-adapter-execution-rules)
    - 12.4 [Staging, Preview, Conflict Resolution, and Idempotent Commit](#124-staging-preview-conflict-resolution-and-idempotent-commit)
13. [Market Price Engine, NAV Sync, and Multi-Currency FX Pipeline](#13-market-price-engine-nav-sync-and-multi-currency-fx-pipeline)
    - 13.1 [Market Data Architecture: Polling / EOD vs. Real-Time Tick Feeds](#131-market-data-architecture)
    - 13.2 [NAV & Stock Quote Fetching Strategy & Multi-Tier Fallbacks](#132-nav--stock-quote-fetching-strategy)
    - 13.3 [Multi-Currency FX Pipeline & Triangular Conversion](#133-multi-currency-fx-pipeline)
    - 13.4 [Market Data Freshness vs. Immediate Net Worth Recalculation](#134-market-data-freshness-vs-immediate-net-worth-recalculation)
14. [AI Advisory and Deterministic Financial Engines](#14-ai-advisory-and-deterministic-financial-engines)
    - 14.1 [Decoupled AI Architecture (Deterministic Core First, LLM Second)](#141-decoupled-ai-architecture)
    - 14.2 [Prompt Sanitization, PII Redaction & Inherent Limitations](#142-prompt-sanitization-pii-redaction--inherent-limitations)
    - 14.3 [MiniMax LLM Integration & Structured Output Contracts](#143-minimax-llm-integration)
15. [Background Jobs, Cron Scheduling, and Notifications](#15-background-jobs-cron-scheduling-and-notifications)
    - 15.1 [Scheduled Worker Execution & Cron Topologies](#151-scheduled-worker-execution)
    - 15.2 [Alert Triggers, Budget Thresholds, and Push Notifications](#152-alert-triggers-budget-thresholds)
16. [Security, Authorization, Tenant Isolation, and Privacy](#16-security-authorization-tenant-isolation-and-privacy)
    - 16.1 [Authentication Framework (Clerk Session & MFA Management)](#161-authentication-framework)
    - 16.2 [Tenant Data Isolation & Service-Layer Authorization](#162-tenant-data-isolation)
    - 16.3 [Zero-Trust Ephemeral File Handling (RAM-Only Processing)](#163-zero-trust-ephemeral-file-handling)
    - 16.4 [Secrets Management, Rate Limiting, Error Redaction & Audit Logging](#164-secrets-management-rate-limiting)
    - 16.5 [Data Export, Soft Deletion, and Hard Purge Guarantees](#165-data-export-soft-deletion)
17. [Calculation Rules, Financial Precision, and Consistency](#17-calculation-rules-financial-precision-and-consistency)
    - 17.1 [Mathematical Models & Algorithmic Implementation](#171-mathematical-models)
    - 17.2 [XIRR Calculation & Numerical Convergence Bounds](#172-xirr-calculation--numerical-convergence-bounds)
    - 17.3 [Loan EMI & Amortization Formulas with Zero-Division Guards](#173-loan-emi--amortization-formulas)
    - 17.4 [Immediate Event-Driven Net Worth Recalculation Engine](#174-immediate-event-driven-net-worth-recalculation-engine)
18. [Caching, Resilience, Observability, and Performance](#18-caching-resilience-observability-and-performance)
    - 18.1 [Multi-Tier Caching Architecture (Redis / Upstash + In-Memory Fallback)](#181-multi-tier-caching-architecture)
    - 18.2 [Resilience, Circuit Breakers, and Exponential Backoff](#182-resilience-circuit-breakers)
    - 18.3 [Observability, Sentry Error Tracking, and Performance Budgets](#183-observability-sentry-error-tracking)
19. [Testing Strategy, Acceptance Criteria, and Reference Test Cases](#19-testing-strategy-acceptance-criteria-and-reference-test-cases)
    - 19.1 [Multi-Layer Testing Pyramid](#191-multi-layer-testing-pyramid)
    - 19.2 [Concrete Reference Acceptance Test Cases](#192-concrete-reference-acceptance-test-cases)
20. [Deployment Architecture and Environment Configuration](#20-deployment-architecture-and-environment-configuration)
    - 20.1 [Target Production Deployment Topology](#201-target-production-deployment-topology)
    - 20.2 [Complete Environment Variables Reference (`.env.example`)](#202-complete-environment-variables-reference)
21. [Measurable Phased Implementation Roadmap](#21-measurable-phased-implementation-roadmap)
    - 21.1 [Phase Dependencies, Deliverables, Regression Tests, Recovery, and Gates](#211-phase-dependencies-deliverables-regression-tests-recovery-and-gates)
22. [Known Limitations, Assumptions, and Open Decisions](#22-known-limitations-assumptions-and-open-decisions)
    - 22.1 [Technical Limitations & Architectural Assumptions](#221-technical-limitations--architectural-assumptions)
    - 22.2 [Open Architectural Decisions & Research Questions](#222-open-architectural-decisions)
23. [Definition of Done](#23-definition-of-done)
24. [Final Architecture Reconciliation Report](#24-final-architecture-reconciliation-report)
    - 24.1 [Restored Substantive Requirements from v2.0](#241-restored-substantive-requirements-from-v20)
    - 24.2 [Valid Corrections Retained from v2.1 and v2.2](#242-valid-corrections-retained-from-v21-and-v22)
    - 24.3 [Explicitly Identified Remaining Unverified Claims](#243-explicitly-identified-remaining-unverified-claims)
    - 24.4 [Unresolved Architectural Decisions](#244-unresolved-architectural-decisions)
    - 24.5 [Section-by-Section Completeness Checklist](#245-section-by-section-completeness-checklist)
    - 24.6 [Confirmation of Zero Application Code Modifications](#246-confirmation-of-zero-application-code-modifications)

---

## 1. Executive Summary and Product Scope

### 1.1 Vision and Positioning
**FinanceAI** is an institutional-grade, privacy-first personal wealth management, portfolio analytics, and financial planning platform engineered for retail investors, high-net-worth individuals (HNIs), and privacy-conscious users in India and globally.

Unlike traditional open-banking aggregators or fintech platforms that require storing sensitive banking credentials, granting screen-scraping permissions, or selling transaction data to third-party ad networks, FinanceAI operates on a **hybrid data architecture**:
1. **Zero-Credential Direct Aggregation:** Portfolio ingestion relies on official broker statement exports (Groww, INDmoney) and regulatory Consolidated Account Statements (CAS PDF via CAMS/KFintech) decrypted purely in volatile RAM.
2. **Deterministic Financial Core:** Every monetary rollup, loan amortization table, investment return (XIRR, CAGR), and financial health score is computed deterministically using mathematical algorithms written in strict TypeScript.
3. **Decoupled AI Intelligence:** Large Language Models (MiniMax / Anthropic) act strictly as an analytical advisor, receiving pre-computed mathematical facts and strictly sanitized financial metrics with zero personally identifiable information (PII).

### 1.2 Core Value Proposition
- **Comprehensive Net Worth Visibility:** Single pane of glass aggregating 20+ asset classes (Indian stocks, US equities, mutual funds, EPF, PPF, NPS, real estate, gold, crypto, cash) and liabilities (home loans, car loans, personal loans, credit card balances).
- **Accurate Returns Calculation:** Computes true money-weighted returns (XIRR) and time-weighted returns (CAGR) across complex multi-broker transaction histories, handling corporate actions, dividends, and irregular SIP cashflows.
- **Debt Elimination Strategy:** Automated loan amortization engine comparing EMI repayment strategies (Snowball vs. Avalanche) with pre-payment impact modeling.
- **Privacy-First Statement Ingestion:** Two-phase staging pipeline allowing users to preview, validate, and reconcile imported broker holdings before committing them to the persistent ledger.
- **Multi-Profile & Multi-Currency Management:** Native support for Indian Rupee (`INR`) with Indian numbering formats (Lakhs/Crores) alongside global currencies (`USD`, `EUR`, `GBP`), with profile isolation for personal, business, and family balance sheets.

### 1.3 Target Audience and User Personas
1. **The Active Indian Retail Investor:** Holds Indian stocks on Groww/Zerodha, mutual funds via CAMS/KFintech, EPF with EPFO, and PPF with SBI/HDFC. Requires a single unified dashboard without sharing net banking passwords.
2. **The Global / Tech Professional:** Earns in INR or USD, holds US stocks (RSUs / ESPP) via INDmoney or Charles Schwab, manages a home loan, and tracks retirement goals (FIRE). Requires multi-currency FX normalization and dual numbering systems (`en-IN` vs `en-US`).
3. **The Family Wealth Guardian:** Manages balance sheets across multiple entities (Self, Spouse, HUF, Minor Children). Requires segregated profile contexts and consolidated family net worth views.

### 1.4 Complete Scope Summary Matrix

| Domain | In-Scope (Core v2.3 Blueprint) | Deferred / Phased Roadmap | Explicit Out-of-Scope (Non-Goals) |
|---|---|---|---|
| **Identity & Access** | Clerk Auth, Email/Password, OAuth (Google/Apple), MFA, Session tokens, Profile switching | Family multi-user invite RBAC | Enterprise LDAP/SAML, Social login scraping |
| **Asset Tracking** | 20+ asset classes, manual entry, statement imports, holdings register, quantity × price valuation | Real estate automated valuation models (AVM) | Direct broker trade execution, automated order routing |
| **Liabilities** | Amortization schedule generator, principal/interest split, prepayments, Snowball/Avalanche comparison | CIBIL/Experian credit score auto-fetch | Direct loan disbursement, refinancing brokerage |
| **Broker Imports** | Groww Stock (XLSX/CSV), Groww MF (XLSX/CSV), INDmoney US Stock (XLS/XLSX), INDmoney MF (XLSX/CSV), CAMS/KFintech CAS PDF | Zerodha Kite/Coin CSV, Upstox CSV, ICICI Direct CSV | Screen-scraping banking portals, Credential harvesting |
| **Market Data** | Daily NAV from `mfapi.in`, EOD quotes & FX from Yahoo Finance, 15-min cached quotes, manual override | Paid real-time exchange feeds (NSE/BSE Level 2) | Ultra-low-latency tick-by-tick algorithmic feeds |
| **AI Advisory** | MiniMax LLM gateway, deterministic financial metric context, PII-sanitized prompts, debt/budget guidance | Voice interface, proactive autonomous alerts | Autonomous trade execution, binding financial advice |
| **Cash Flow** | Income/Expense ledger, transfer pairing, budget tracking, 80%/100% threshold alerts | Bank statement auto-categorization ML models | Direct UPI payments, payment gateway merchant processing |
| **Storage & Infra** | PostgreSQL via Prisma, Redis/Upstash caching, Vercel Edge/Serverless deployment, Ephemeral RAM buffers | Self-hosted Docker deployment scripts | Decentralized blockchain storage, IPFS |

---

## 2. Architecture Principles and Scope Boundaries

### 2.1 Core Architectural Principles
1. **Zero-Trust Ephemeral File Processing:** Sensitive user files (especially password-protected CAS PDFs and broker spreadsheets) must be processed entirely in volatile memory (RAM). Under no circumstances shall an uploaded statement or its decrypted buffer be written to persistent disk, S3 buckets, or temporary directories. Memory buffers are cleared immediately upon parsing and staging.
2. **Deterministic Core vs. Stochastic Advisory Decoupling:** All mathematical computations—including Net Worth rollups, loan amortization schedules, XIRR convergence, budget variance, and financial health scores—are executed by deterministic TypeScript engines. Large Language Models are strictly prohibited from calculating mathematical figures. AI receives pre-computed numerical summaries.
3. **Strict Profile & Tenant Isolation:** Every database read, mutation, aggregation, and cache key must be explicitly scoped by `userId` and `profileId` (or `accountId`). Global queries lacking tenant predicates are strictly disallowed.
4. **Immediate Recalculation vs. Polling Market Freshness:** Financial aggregations (Account Balances, Total Liabilities, Net Worth rollups) are recalculated immediately and synchronously upon transaction or holding mutations. Market pricing data (NAV, stock prices, FX rates) follows an asynchronous polling/caching model (EOD or 15-minute TTL) and updates balances through scheduled workers or manual refresh.
5. **Idempotent Statement Ingestion:** Statement uploads must never double-count holdings or transactions. Every imported record is assigned a deterministic deduplication hash scoped to `userId`, `accountId`, and holding/transaction attributes. Re-uploading the same statement must result in an identical ledger state.

### 2.2 System Scope Boundaries

#### In Scope (Core Application Boundaries)
- **Net Worth Command Center:** Multi-currency, multi-profile balance sheet aggregating assets and liabilities.
- **Portfolio Holding Register:** Tracking shares, units, purchase prices, current market values, and unrealized gains/losses.
- **Debt Engine:** Complete loan amortization calculation, EMI schedules, prepayment modeling, and payoff optimization.
- **Broker Import Adapters:** Verified parsing for Groww (Stocks & Mutual Funds) and INDmoney (US Stocks & Mutual Funds), plus target CAMS/KFintech CAS PDF support.
- **Cash Flow Ledger:** Double-entry-aware paired transfers, categorized expenses, income records, and monthly budget limits.
- **Financial Planning:** Goal tracking, retirement projection (FIRE calculator), SIP compounding analysis.
- **Privacy Gateway:** Algorithmic PII scrubbing (masking names, emails, account numbers, folio numbers) before forwarding context to LLM APIs.

#### Out of Scope (Explicit Non-Goals)
- **Direct Brokerage Trading:** FinanceAI does not connect to broker trading APIs (Zerodha Kite Connect, Groww Trading API) to place buy/sell orders.
- **Direct Bank Account Screen Scraping:** No headless browser scraping or credential harvesting for net banking portals.
- **Binding Regulatory Financial Advice:** AI output is clearly disclaimed as informational and educational, not SEBI/SEC-registered financial advisory.
- **Payment Processing / Money Movement:** FinanceAI does not initiate bank transfers, UPI transactions, or bill payments.
- **High-Frequency Real-Time Market Tickers:** FinanceAI is a wealth management tracker, not an intra-day trading terminal; sub-second WebSocket feeds are an explicit non-goal.

---

## 3. Verified Current State Audit vs. Benchmark Capabilities

### 3.1 Audit Methodology & Codebase Ground Truth
A deep-code verification was conducted across the current FinanceAI repository:
- **Routes & Middleware:** `middleware.ts`, `app/api/`
- **Prisma Schema:** `prisma/schema.prisma`
- **Import Services & Adapters:** `src/services/import.service.ts`, `src/adapters/*.ts`
- **Pricing & Market Feeds:** `src/services/market.service.ts` (or equivalent in `app/api/prices/`)
- **Automated Tests:** `tests/adapters.test.ts`, `tests/import-flow.test.ts`
- **Benchmark Source:** FinBoom comprehensive research report (`audit.md`)

Every architectural claim is evaluated against verified source code. Where a feature exists in the benchmark or architectural design but lacks implementation in the repository, it is explicitly classified as **Planned (Target)** with required remediation.

### 3.2 Verified Code State vs. FinBoom Benchmark Matrix

| Functional Capability | FinBoom Benchmark (audit.md) | FinanceAI Current Codebase Status | Verified Code Evidence | Deficiencies & Remediation Strategy |
|---|---|---|---|---|
| **User Authentication** | Mobile OTP, Google OAuth, Session persistence | Implemented (Verified) | `middleware.ts`, Clerk Auth integration in App Router | Multi-profile switching is missing in current `User` schema. Need `Profile` model. |
| **Groww Stock Import** | Full portfolio import from broker spreadsheet | Implemented (Verified) | `src/adapters/groww-stock.adapter.ts`, `tests/adapters.test.ts` (Describe A) | Supports XLSX/CSV, extracts ISIN, quantity, statement price. Needs persistent staging table. |
| **Groww Mutual Fund Import** | Multi-folio mutual fund tracking | Implemented (Verified) | `src/adapters/groww-mutualfund.adapter.ts`, `tests/adapters.test.ts` (Describe B) | Correctly distinguishes same scheme in different folios. Statement NAV preserved when offline. |
| **INDmoney US Stock Import** | Global equity tracking with USD cost basis | Implemented (Verified) | `src/adapters/indmoney-usstock.adapter.ts`, `tests/adapters.test.ts` (Describe C) | Supports legacy `.xls` and `.xlsx`, USD currency, fractional quantities. |
| **INDmoney Mutual Fund Import** | Indian mutual fund holding ingestion | Implemented (Verified) | `src/adapters/indmoney-mutualfund.adapter.ts`, `tests/adapters.test.ts` (Describe D) | Extracts ISIN, folio, derived avg price. Statement totals validated. |
| **INDmoney Indian Stocks** | Mentioned in generic broker import claims | Explicitly Unsupported (Verified) | `tests/adapters.test.ts` ("unsupported combination explains why") | Adapter intentionally rejects this export. Must build dedicated adapter in Phase 2. |
| **CAMS / KFintech CAS PDF** | Consolidated mutual fund PDF parsing with password | Not Implemented (Target) | No PDF parsing library or adapter found in `src/` | Must integrate `pdfjs-dist` / `pdf-parse` with ephemeral in-memory password decryption. |
| **Broker Idempotent Re-import** | Update existing holdings without duplication | Implemented (Verified) | `src/services/import.service.ts`, `tests/import-flow.test.ts` (Describe H) | Deduplication relies on `importKey`. Missing `accountId` in current unique constraint! |
| **Market Price Enrichment** | Real-time prices across all assets | Partial / Delayed (Verified) | `mfapi.in` for Indian MFs, Yahoo Finance for stocks | Polled / EOD data, NOT real-time. In-memory Map cache needs Redis/Upstash migration. |
| **Foreign Exchange (FX)** | Multi-currency portfolio valuation | Partial (Verified) | Yahoo Finance USD/INR conversion | Historical FX rates not persisted in DB; needs `FXRate` model and daily sync cron. |
| **Loan & Debt Engine** | Full amortization schedules, EMI calculator | Partial (Model Only) | `prisma/schema.prisma` has `Liability` model | Missing `LoanAmortizationSchedule` table, Snowball/Avalanche math, and prepayment simulation. |
| **Cash Flow & Transfers** | Income, expense, and account transfers | Partial (Model Only) | `prisma/schema.prisma` has `Transaction` model | Transfers lack pairing (`transferGroupId` missing). No linked `Account` foreign key. |
| **Financial Health Score** | Comprehensive financial health index (0–100) | Conceptual / UI Only | Basic UI cards in dashboard | Lacks deterministic scoring algorithms (Emergency Fund, DTI, Savings Rate, Net Worth ratio). |
| **AI Advisory Gateway** | Conversational financial copilot | Implemented (Verified) | `test-minimax.ts`, `AIConversation` model in Prisma | Connects to MiniMax LLM. Lacks formal PII redaction pipeline before prompt dispatch. |

### 3.3 Broker Import Capability Audit (Groww & INDmoney Asset-by-Asset Audit)

A rigorous technical audit was performed directly on the adapter implementations and test suites. **Under no circumstances should a format be considered verified merely because an adapter file exists.**

#### 1. Groww Stocks (`IN_STOCK`)
- **Verified Files:** `src/adapters/groww-stock.adapter.ts`, `tests/adapters.test.ts` (Suite A)
- **Supported File Formats:** Microsoft Excel (`.xlsx`) and Comma-Separated Values (`.csv`).
- **Layout Handling:** Parses header-offset layouts (identifies header row dynamically despite preceding account metadata rows).
- **Data Extracted:** ISIN (`INE...`), Company Name, Quantity, Average Buy Price, Invested Value, Statement Market Price.
- **Identity Derivation:** Deterministic `importKey` constructed as `GROWW|IN_STOCK|<ISIN>`.
- **Edge Cases Verified in Tests:** Empty statements yield zero rows with a user warning (no crash); personal metadata (user name, PAN) is skipped and never imported into holdings.

#### 2. Groww Mutual Funds (`IN_MUTUAL_FUND`)
- **Verified Files:** `src/adapters/groww-mutualfund.adapter.ts`, `tests/adapters.test.ts` (Suite B)
- **Supported File Formats:** `.xlsx` and `.csv`.
- **Layout Handling:** Skips leading metadata, handles blank rows immediately following headers, parses string-formatted numbers.
- **Data Extracted:** Scheme Name, Folio Number, ISIN, Units (Quantity), Average NAV (Price), Total Invested, Current NAV.
- **Identity Derivation:** `GROWW|IN_MUTUAL_FUND|<ISIN>|<FOLIO>`.
- **Edge Cases Verified in Tests:** Identical scheme held across two different folio numbers is preserved as two distinct holdings; reconciliation warning emitted if row totals disagree with statement summary total.

#### 3. INDmoney US Stocks (`US_STOCK`)
- **Verified Files:** `src/adapters/indmoney-usstock.adapter.ts`, `tests/adapters.test.ts` (Suite C)
- **Supported File Formats:** Binary Excel (`.xls`) and Modern Excel (`.xlsx`).
- **Currency Handling:** Explicitly parses USD currency headers containing `($)`; rejects non-USD price columns.
- **Data Extracted:** Symbol (Ticker), Company Name, Quantity (supports fractional shares up to 6 decimals), Average Price in USD, Total Invested in USD.
- **Identity Derivation:** `INDMONEY|US_STOCK|<SYMBOL>`.
- **Edge Cases Verified in Tests:** Ignores disclaimer footers and customer account headers; flags mathematical discrepancy if Total Value $\neq$ Quantity $\times$ Average Price.

#### 4. INDmoney Mutual Funds (`IN_MUTUAL_FUND`)
- **Verified Files:** `src/adapters/indmoney-mutualfund.adapter.ts`, `tests/adapters.test.ts` (Suite D)
- **Supported File Formats:** `.xlsx` and `.csv`.
- **Data Extracted:** ISIN, Folio Number, Scheme Name, Units, Average Buy NAV, Current Statement NAV.
- **Identity Derivation:** `INDMONEY|IN_MUTUAL_FUND|<ISIN>|<FOLIO>`.
- **Edge Cases Verified in Tests:** Rejects malformed ISIN strings; coerces text numbers into valid floating-point values.

#### 5. Unverified / Unsupported Broker Formats (Explicitly Audited)
- **INDmoney Indian Stocks (`IN_STOCK`):** **EXPLICITLY UNSUPPORTED**. Code throws a descriptive user error explaining that INDmoney Indian equity export format is not yet mapped.
- **Groww Futures & Options (F&O):** **NOT SUPPORTED**. No derivative contract adapter exists.
- **INDmoney Fixed Deposits (FD) & US Cash:** **NOT SUPPORTED**.
- **Zerodha (Kite / Coin):** **NOT SUPPORTED**. No adapter exists in current codebase.
- **CAMS / KFintech CAS PDF:** **NOT SUPPORTED IN CODE**. Architectural specification complete; parser implementation scheduled for Phase 2.



## 4. Comprehensive Feature Register

### 4.1 Classification Taxonomy
To ensure total architectural rigor and avoid unsupported assumptions, every feature in the FinanceAI platform is categorized according to its provenance:
1. **Benchmark Observed (`BENCHMARK`):** Explicitly observed and verified in the FinBoom competitive audit (`audit.md`).
2. **Inferred from Research (`INFERRED`):** Architecturally required to support a benchmark capability (e.g., persistent import staging tables, database deduplication constraints).
3. **FinanceAI Original (`ORIGINAL`):** Native capabilities designed specifically for FinanceAI (e.g., Clerk Auth integration, MiniMax LLM advisory, `mfapi.in` integration).
4. **New Enhancement (`ENHANCEMENT`):** Production-grade enterprise additions introduced to resolve architectural gaps (e.g., Redis caching layer, `Decimal(19, 4)` precision migration, double-entry paired transfer grouping).

### 4.2 Master Feature Register Table

| Feature Name | Category | Origin | Current Status & Code Evidence | Required Target Behavior | Priority & Dependencies | Acceptance Criteria & Test Cases | Known Limitations & Decisions |
|---|---|---|---|---|---|---|---|
| **Executive Net Worth Command Center** | Dashboard | `BENCHMARK` | **Implemented (Verified UI/Calc)**  `app/(dashboard)/dashboard/page.tsx` | Displays total net worth ($Assets - Liabilities$) in active currency (INR/USD), 30-day change, asset/liability cards. | **P0** (Core)  Deps: `Asset`, `Liability` | AC: Net worth rolls up synchronously upon transaction or asset update. Test: Adding ₹10k asset increments net worth by ₹10k immediately. | Does not support profile filtering in current UI. Deferred to multi-profile release. |
| **Balance Sheet Privacy Mode** | Dashboard | `BENCHMARK` | **Implemented (Verified)**  `prisma/schema.prisma` (`privacyMode`) | Toggles obscuring of all monetary figures with asterisks (`₹••••••`) across all views. Persists to user profile. | **P1**  Deps: `User` state | AC: Clicking eye icon masks all values. Local storage & DB flag sync. Test: Screenshot/DOM verification of masked elements. | In-memory DOM text replacement; sensitive figures still present in HTML attributes if not scrubbed. |
| **Groww Stock Import** | Imports | `ORIGINAL` | **Implemented (Verified)**  `src/adapters/groww-stock.adapter.ts` | Parses Groww equity XLSX/CSV exports, maps ISIN, average cost, shares, and statement price. | **P0**  Deps: `import.service.ts` | AC: Parses multi-sheet Excel with header offset. Test: `tests/adapters.test.ts` Suite A passes with 0 errors. | Only supports Indian equity cash segment; F&O exports rejected. |
| **Groww Mutual Fund Import** | Imports | `ORIGINAL` | **Implemented (Verified)**  `src/adapters/groww-mutualfund.adapter.ts` | Ingests Groww mutual fund holdings, tracks folio numbers, unit balances, and statement NAV. | **P0**  Deps: `import.service.ts` | AC: Multi-folio holdings for identical scheme retained as distinct entities. Test: `tests/adapters.test.ts` Suite B. | Does not parse historical SIP transaction ledger; imports current holding snapshot. |
| **INDmoney US Stock Import** | Imports | `ORIGINAL` | **Implemented (Verified)**  `src/adapters/indmoney-usstock.adapter.ts` | Parses INDmoney US stock exports (.xls/.xlsx), stores USD valuation, supports fractional shares. | **P0**  Deps: `import.service.ts` | AC: Retains USD currency, parses fractional units (e.g., 0.123456 shares). Test: `tests/adapters.test.ts` Suite C. | Historical FX rate at purchase date not captured; uses cost basis. |
| **INDmoney Mutual Fund Import** | Imports | `ORIGINAL` | **Implemented (Verified)**  `src/adapters/indmoney-mutualfund.adapter.ts` | Ingests INDmoney Indian mutual fund holdings via XLSX/CSV, extracts ISIN and folio. | **P0**  Deps: `import.service.ts` | AC: ISIN and folio mapped into composite `importKey`. Test: `tests/adapters.test.ts` Suite D. | INDmoney Indian stock exports are explicitly unsupported. |
| **CAMS / KFintech CAS PDF Import** | Imports | `BENCHMARK` | **Planned (Target)**  `docs/spec.md` (Not in code) | Ephemeral in-memory decryption of password-protected PDF; tokenizes folio, ISIN, NAV, units. | **P1**  Deps: `pdfjs-dist`, RAM worker | AC: Never writes PDF to disk. In-memory buffer wiped after staging. Test: Sample password-protected CAS decrypts cleanly. | Handling complex password variations (PAN + DOB permutations) requires clear UX prompts. |
| **Persistent Import Staging & Preview** | Imports | `INFERRED` | **Partial (In-Memory)**  `tests/import-flow.test.ts` (`preview`) | Uploaded files parsed into `ImportStagingRow` table, allowing user to preview additions, updates, deletions before commit. | **P0**  Deps: `ImportBatch`, `ImportStagingRow` | AC: User can review proposed changes, uncheck rows, and commit atomically. Test: Preview rejects corrupt files with zero DB writes. | Currently simulated in-memory in `import.service.ts`; needs persistent DB staging tables. |
| **Scoped Deduplication Hash** | Ledger | `ENHANCEMENT` | **Deficient in Code**  `prisma/schema.prisma` (`unique([userId, importKey])`) | Deduplication scoped to `userId_accountId_dedupHash`. Enables identical holdings across different accounts/profiles. | **P0** (Bugfix)  Deps: Prisma migration | AC: User can hold identical stock across two distinct accounts without unique constraint violation. Test: DB insert test. | Current schema lacks `accountId` in unique constraint; causes cross-account collisions. |
| **Paired Account Transfers** | Ledger | `BENCHMARK` | **Partial (Model Only)**  `prisma/schema.prisma` (`Transaction`) | Double-entry transfer recording debit from Account A and credit to Account B linked by `transferGroupId`. | **P1**  Deps: `Account` model, `transferGroupId` | AC: Deleting or editing one leg of a transfer updates or deletes the paired leg atomically. Test: Balance integrity test. | Current schema stores transfers as single unlinked transaction records. |
| **Multi-Profile Isolation (Family / HUF)** | Identity | `BENCHMARK` | **Planned (Target)**  Documented in v2.0/v2.2 | Create distinct financial profiles (Self, Spouse, HUF, Business) under a single authenticated user account. | **P1**  Deps: `Profile` model | AC: All queries filter by `profileId`. Switching profile changes dashboard state with zero data bleed. Test: Multi-tenant test. | Not implemented in current Prisma schema. Schema migration required. |
| **Loan Amortization Engine** | Liabilities | `BENCHMARK` | **Partial (Model Only)**  `prisma/schema.prisma` (`Liability`) | Generates full monthly amortization schedule (principal vs interest), calculates EMI, models prepayments. | **P0**  Deps: `LoanAmortizationSchedule` | AC: Generates exact schedule matching institutional banking standards. Test: ₹10L @ 8.5% for 20y yields ₹8,678.23 EMI. | Current schema only holds static principal and EMI fields; no schedule generation logic. |
| **Debt Payoff Optimizer (Snowball vs Avalanche)** | Liabilities | `BENCHMARK` | **Planned (Target)**  Documented in v2.0/v2.2 | Compares repayment order: lowest balance first (Snowball) vs highest interest rate first (Avalanche) with interest savings. | **P2**  Deps: Debt Engine | AC: Outputs side-by-side timeline and total interest paid under both strategies. Test: Mathematical verification test. | Requires full liability schedule modeling. |
| **Mutual Fund NAV Polling** | Market Data | `ORIGINAL` | **Implemented (Verified)**  `mfapi.in` API integration | Daily fetching of mutual fund NAV via open `mfapi.in` endpoint using AMFI scheme codes. | **P0**  Deps: `mfapi.in` | AC: NAV updated daily; fallback to statement NAV if API unreachable. Test: `tests/import-flow.test.ts` Suite L. | `mfapi.in` updates daily at 21:00-23:00 IST; not real-time intraday. |
| **Stock & Global Asset Pricing** | Market Data | `ORIGINAL` | **Implemented (Verified)**  `yahoo-finance2` integration | Fetches delayed (15-min) and EOD stock quotes, crypto, and currency pairs. | **P0**  Deps: Yahoo Finance API | AC: Ticker mapped (e.g. `RELIANCE.NS`, `AAPL`); quote cached with 15-min TTL. Test: Market service integration test. | Yahoo Finance free tier subject to IP rate limits; requires resilient caching. |
| **Multi-Tier Caching (Redis / Upstash)** | Infra | `ENHANCEMENT` | **Deficient in Code**  In-memory `Map` cache in code | Distributed cache-aside layer for quotes, FX rates, and calculated net worth aggregates with Redis. | **P0** (Infra)  Deps: Redis/Upstash | AC: Cache hit returns in < 5ms. In-memory Map retained as local fallback. Test: Cache hit/miss unit test. | Current codebase uses node process in-memory `Map`; cache lost on serverless function restart. |
| **Decimal Precision Migration** | Database | `ENHANCEMENT` | **Deficient in Code**  `Float` fields in `schema.prisma` | Migrate all financial balance and monetary fields from IEEE 754 `Float` to `Decimal(19, 4)` in PostgreSQL. | **P0** (Data)  Deps: Prisma migration | AC: Financial sums maintain exact precision with zero floating-point drift. Test: $0.1 + 0.2 = 0.3000$ exact test. | Requires database migration and cast script for existing floating point rows. |
| **Portfolio XIRR Calculation** | Analytics | `BENCHMARK` | **Planned (Target)**  Algorithm in v2.0 spec | Computes annualized internal rate of return using Newton-Raphson method with bisection fallback. | **P1**  Deps: Cashflow ledger | AC: Converges within 100 iterations to $10^{-6}$ tolerance. Test: Reference cashflows [-100k, +115k @ 1y] yields 15.00%. | Extreme cashflow patterns can diverge; requires strict iteration bounds. |
| **Financial Health Score (0–100)** | Analytics | `BENCHMARK` | **Conceptual / UI Only**  Dashboard card placeholder | Deterministic evaluation of Emergency Fund (25%), DTI (25%), Savings Rate (25%), Net Worth/Income (25%). | **P1**  Deps: Ledger, Debt engine | AC: Produces integer score (0-100) with grade and deterministic action points. Test: Unit test with boundary test cases. | Must be 100% deterministic; zero LLM generation of scores. |
| **Privacy-Preserving AI Advisory Gateway** | AI Advisor | `ORIGINAL` | **Implemented (Verified Base)**  `test-minimax.ts`, `AIConversation` | Conversational financial copilot powered by MiniMax LLM. Receives sanitized financial summaries. | **P1**  Deps: MiniMax API, PII scrubber | AC: PII (names, emails, account numbers) stripped before LLM request. Test: Masking regex validation test. | LLMs can hallucinate; UI must present prominent educational disclaimers. |
| **Financial Calculators Suite** | Tools | `BENCHMARK` | **Planned (Target)**  Documented in v2.0 spec | Client-side calculators: SIP, Lumpsum, Step-up SIP, EMI Prepayment, FIRE, Compound Interest, PPF, EPF. | **P2**  Deps: Math library | AC: Instant interactive sliders, amortization tables, downloadable PDF/CSV reports. Test: Unit tests per formula. | Pure client-side React components; zero backend dependencies. |

---

## 5. Functional Modules and Feature Specifications

### 5.1 Executive Dashboard & Net Worth Command Center
- **Net Worth Hero Metric:** Computes aggregate net worth ($NetWorth = \sum Assets - \sum Liabilities$) converted into the active display currency (`INR` or `USD`). Displays absolute change and percentage change over selectable time intervals: `1M`, `3M`, `6M`, `1Y`, `YTD`, `ALL`.
- **Immediate Event-Driven Rollup:** Unlike market data which is polled periodically, the Net Worth Hero Metric recalculates immediately and synchronously whenever the user adds, edits, or deletes an asset, transaction, or liability.
- **Balance Sheet Allocation Visualizer:** Dual interactive donut charts:
  - *Asset Allocation:* Equities (Indian & US), Mutual Funds, Fixed Income, Real Estate, Gold, Crypto, Cash & Bank Balances.
  - *Liability Breakdown:* Home Loans, Auto Loans, Personal Loans, Education Loans, Credit Cards.
- **Privacy Mode Toggle:** A persistent UI action (eye icon in header) that obscures all monetary balances with asterisks (`₹••••••`), enabling discreet usage in public or screen-sharing environments. The toggle state is synchronized to user preferences in the database.
- **Multi-Profile Selector:** Dropdown switcher allowing users to toggle context between `Personal`, `Family / HUF`, and `Business` balance sheets, dynamically updating all cards, charts, and metrics.

### 5.2 Wealth & Asset Management Register (20+ Standard Asset Classes)
The asset engine provides comprehensive lifecycle management for 20+ standardized asset categories:
1. **Indian Listed Equities:** Ticker, ISIN, Exchange (NSE/BSE), Quantity, Average Buy Price, Current Market Price, Sector, Market Cap.
2. **US & Global Equities:** Symbol, Exchange (NASDAQ/NYSE), Fractional Quantity (up to 6 decimals), Cost Basis in USD, Current Price in USD, FX Conversion Rate.
3. **Indian Mutual Funds:** Scheme Name, AMFI Scheme Code, ISIN, Folio Number, Units, Average NAV, Latest NAV, Category (Equity/Debt/Hybrid).
4. **Fixed Deposits (FD):** Bank/NBFC Name, Principal Amount, Interest Rate, Compounding Frequency, Start Date, Maturity Date, Maturity Value.
5. **Recurring Deposits (RD):** Monthly Installment, Interest Rate, Tenure, Accumulated Corpus.
6. **Public Provident Fund (PPF):** Account Number, Annual Contribution, Current Balance, Statutory Interest Rate (government-set, quarterly update).
7. **Employees' Provident Fund (EPF):** Member ID, Employee Share, Employer Share, Pension Share (EPS), Statutory Interest Rate.
8. **National Pension System (NPS):** PRAN, Tier I / Tier II Balance, Fund Manager, Asset Allocation (E/C/G/A split).
9. **Sovereign Gold Bonds (SGB):** Tranche Name, Units (grams), Issue Price, Maturity Date, Semi-Annual Interest Rate (2.5% p.a.).
10. **Physical Gold & Silver:** Form (Bar, Coin, Jewelry), Quantity (grams), Purity (24K, 22K), Purchase Price, Current Metal Rate.
11. **Real Estate (Residential & Commercial):** Property Name, Address, Purchase Date, Purchase Price, Estimated Current Valuation, Rental Yield.
12. **Cryptocurrencies:** Ticker (BTC, ETH, SOL), Wallet/Exchange, Quantity, Average Buy Price in USD/INR, Live Price.
13. **Cash & Savings Accounts:** Bank Name, Account Type, Account Number (last 4 digits), Current Balance, Interest Rate.
14. **Treasury Bills & Government Bonds:** Security Code, Face Value, Yield to Maturity (YTM), Maturity Date.
15. **Corporate Bonds & Debentures:** Issuer Name, Credit Rating (AAA, AA+), Coupon Rate, Payment Frequency.
16. **Private Equity & Angel Investments:** Company Name, Round, Investment Amount, Share Class, Estimated Valuation.
17. **Peer-to-Peer (P2P) Lending:** Platform Name, Principal Invested, Expected Return, Default Rate Provision.
18. **RSUs & ESOPs:** Grant Date, Vesting Schedule, Total Granted, Vested Units, Exercise Price, Fair Market Value.
19. **Commodities & Agricultural Assets:** Commodity Type, Quantity, Storage Facility, Cost Basis, Spot Valuation.
20. **Collectibles & Alternative Wealth:** Category (Art, Watches, Vintage Automobiles), Acquisition Cost, Appraised Value.

### 5.3 Liabilities, Loans & Debt Engine
- **Comprehensive Liability Ledger:** Tracks Home Loans, Auto Loans, Personal Loans, Education Loans, Credit Card Outstanding, and Loans Against Property (LAP).
- **Automated Amortization Schedule Generator:** Generates the complete month-by-month repayment schedule from loan origination to maturity, calculating exact principal and interest components for every EMI payment.
- **Prepayment Simulation Engine:** Models the financial impact of lump-sum prepayments or recurring extra EMI payments, showing exact interest savings and loan tenure reduction.
- **Debt Payoff Optimizer:** Side-by-side comparison of debt elimination strategies:
  - *Debt Avalanche:* Prioritizes debt with the highest interest rate, minimizing total interest paid.
  - *Debt Snowball:* Prioritizes debt with the lowest outstanding balance, maximizing psychological momentum.
- **Debt-to-Income (DTI) Monitoring:** Computes monthly DTI ratio ($Total Monthly Debt Payments / Gross Monthly Income$) and alerts users when approaching or exceeding high-risk thresholds (> 40%).

### 5.4 Cash Flow, Accounts & Multi-Currency Ledger
- **Financial Account Registry:** Tracks distinct financial accounts (Savings Accounts, Current Accounts, Credit Cards, Demat/Trading Accounts, Digital Wallets) linked to specific profiles.
- **Double-Entry Paired Transfers:** When transferring funds between internal accounts (e.g., from HDFC Savings to Zerodha Trading), the system creates two paired transaction legs sharing a unique `transferGroupId`:
  - Debit leg: $-\text{Amount}$ on source account.
  - Credit leg: $+\text{Amount}$ on destination account.
  - Preserves net worth neutrality ($NetWorth$ change is exactly zero) while updating individual account balances.
- **Budgeting & Spending Limits:** Allows setting monthly spending budgets per category (Groceries, Dining, Utilities, Entertainment, Travel). Enforces configurable threshold alerts at 80% and 100% of budget utilization.
- **Multi-Currency Transactions:** Transactions recorded in foreign currencies (e.g., USD subscription paid via INR credit card) capture the original currency, original amount, applied exchange rate, and normalized base currency amount.

### 5.5 Portfolio Analytics, Allocation & Performance (XIRR, CAGR)
- **Extended Internal Rate of Return (XIRR):** Computes money-weighted returns across all cash inflows (SIPs, lump sums, purchases) and cash outflows (redemptions, dividends) together with the current portfolio valuation.
- **Compound Annual Growth Rate (CAGR):** Computes time-weighted point-to-point annualized returns for individual holdings and the aggregate portfolio over multi-year periods ($CAGR = (V_{final} / V_{initial})^{1/n} - 1$).
- **Benchmark Comparison:** Overlays portfolio performance against benchmark indices:
  - Indian Equities & Mutual Funds vs. **NIFTY 50 TRI** and **NIFTY 500 TRI**.
  - US Equities vs. **S&P 500 Total Return** and **NASDAQ 100**.
- **Multi-Dimensional Asset Allocation:** Visualizes portfolio distribution across:
  - *Asset Class:* Equities, Fixed Income, Commodities, Real Estate, Cash.
  - *Market Capitalization:* Large Cap (> ₹20,000 Cr), Mid Cap (₹5,000–20,000 Cr), Small Cap (< ₹5,000 Cr).
  - *Sector Allocation:* Financial Services, IT, Healthcare, FMCG, Energy, Auto, Industrials.
  - *Geographic Exposure:* Domestic (India) vs. International (US, Europe, Emerging Markets).

### 5.6 Multi-Broker Import Pipeline (Staging, Deduplication, Reconciliation)
- **Zero-Storage Ephemeral Parsing:** Uploaded spreadsheets and PDFs are parsed in volatile RAM using Node.js stream buffers. Raw files are never written to disk or cloud object storage.
- **Two-Phase Staging Pipeline:**
  - *Phase 1 (Staging & Validation):* Parsed holdings are inserted into an `ImportBatch` and `ImportStagingRow` table with status `PENDING_PREVIEW`. Validation rules run against every row, flagging discrepancies (e.g., quantity mismatch, missing ISIN).
  - *Phase 2 (User Preview & Atomic Commit):* The UI displays a diff view showing New Holdings, Updated Quantities, and Holdings Missing from Statement (potential sales). The user can deselect specific rows before confirming commit.
- **Idempotent Snapshot Reconciliation:** Supports `replaceMissing` mode. If a full statement is imported, positions missing from the statement are marked as sold or soft-deleted, while reappearing positions are restored, preventing duplicate entries.
- **Resilient Deduplication Scoping:** Every holding record generates an `importKey` constructed as `<BROKER>|<ASSET_CLASS>|<IDENTITY>` and enforces uniqueness via a compound constraint on `[userId, accountId, importKey]`.

### 5.7 Financial Planning, Goals & FIRE Tracking
- **Goal-Based Investing:** Create and track financial goals (e.g., Child's Education, Home Purchase, Emergency Fund, Retirement).
- **Asset-to-Goal Linking:** Explicitly map specific investment holdings or monthly SIP contributions to individual goals.
- **Goal Health & Feasibility Projection:** Computes required monthly savings based on target date, target amount, current accumulated corpus, and expected rate of return using standard financial TVM (Time Value of Money) formulas.
- **FIRE (Financial Independence, Retire Early) Engine:**
  - Projects retirement age and required FIRE corpus based on current annual expenses, savings rate, inflation rate, and expected post-retirement safe withdrawal rate (SWR, typically 3.5%–4.0%).
  - Calculates four distinct FIRE targets:
    1. *Lean FIRE:* Bare-minimum annual living expenses ($25 \times \text{Essential Expenses}$).
    2. *Standard FIRE:* Current standard of living ($25–30 \times \text{Current Expenses}$).
    3. *Fat FIRE:* Abundant lifestyle with luxury buffer ($40–50 \times \text{Current Expenses}$).
    4. *Coast FIRE:* Accumulated corpus that will grow to cover retirement expenses at traditional retirement age without further contributions.

### 5.8 Deterministic Financial Health Score Engine
To guarantee institutional integrity, the Financial Health Score (0–100) is computed **100% deterministically** using pure TypeScript mathematical algorithms. Large Language Models are strictly prohibited from generating or modifying scores.

The score comprises four equal-weighted pillars (25 points each):
1. **Emergency Fund Adequacy (25 Points):**
   $$\text{Score}_{EF} = \min\left(25, \frac{\text{Liquid Cash & Bank Balances}}{\text{Monthly Expenses} \times 6} \times 25\right)$$
   - Full 25 points achieved at $\ge 6$ months of living expenses held in liquid cash/FDs.
2. **Debt-to-Income (DTI) Ratio (25 Points):**
   - $DTI \le 20\%$: 25 points.
   - $20\% < DTI \le 35\%$: 18 points.
   - $35\% < DTI \le 50\%$: 10 points.
   - $DTI > 50\%$: 0 points.
3. **Savings & Investment Rate (25 Points):**
   $$\text{Savings Rate} = \frac{\text{Monthly Income} - \text{Monthly Expenses}}{\text{Monthly Income}}$$
   - Savings Rate $\ge 40\%$: 25 points.
   - $25\% \le \text{Rate} < 40\%$: 18 points.
   - $10\% \le \text{Rate} < 25\%$: 10 points.
   - $\text{Rate} < 10\%$: 0 points.
4. **Net Worth to Age Multiple (25 Points):**
   - Evaluates accumulated net worth relative to gross annual income and age based on standard wealth benchmarks (Stanley & Danko / Fidelity Wealth Multiples).

### 5.9 Privacy-Preserving AI Advisory Gateway
- **Decoupled Architecture:** User queries pass through a deterministic context assembly layer that extracts necessary mathematical facts (DTI, Net Worth, Asset Allocation percentages) and scrubs all personally identifiable information (PII) before calling the LLM.
- **PII Scrubbing Pipeline:** Replaces user names, email addresses, exact bank account numbers, and mutual fund folio numbers with anonymized placeholders (`[USER_01]`, `[ACCOUNT_A]`, `[FOLIO_REDACTED]`).
- **Structured JSON Advisory Contracts:** Prompts enforce strict JSON output schemas from MiniMax LLM, validating responses against Zod schemas before rendering to the user.
- **Educational Disclaimers:** All advisory screens display prominent legal disclaimers: *"FinanceAI Advisory provides educational analysis based on user-provided financial records. It does not constitute registered SEBI/SEC financial or investment advice."*

### 5.10 Financial Calculators Suite
Interactive, zero-latency client-side financial calculators featuring real-time sliders, dynamic Recharts visualization, and printable amortization schedules:
1. **SIP Calculator:** Computes future corpus with expected return and tenure; displays total invested vs wealth gained.
2. **Lumpsum Investment Calculator:** Future value computation for single one-time investments.
3. **Step-Up SIP Calculator:** Models annual SIP contribution step-ups (e.g., 10% annual increase matching salary growth).
4. **Loan EMI & Prepayment Calculator:** Full amortization schedule breakdown, comparing baseline tenure vs. regular prepayment impact.
5. **FIRE Retirement Calculator:** Interactive retirement timeline projector with variable inflation, savings rate, and return assumptions.
6. **Compound Interest Calculator:** Compounding frequency options (daily, monthly, quarterly, semi-annually, annually).
7. **PPF Calculator:** 15-year statutory maturity calculation with 5-year block extension rules.
8. **EPF Corpus Calculator:** Projects retirement EPF corpus based on basic salary, annual increments, and statutory EPF contribution rules.



## 6. Application Navigation and Page Architecture

### 6.1 Complete Sitemap and Route Architecture (Next.js 14 App Router)
FinanceAI leverages the **Next.js 14 App Router** paradigm with grouped route hierarchies, nested layouts, and React Server Components (RSC):

```
app/
├── (auth)/
│   ├── sign-in/[[...sign-in]]/page.tsx     # Clerk Managed Sign-In (OAuth, Email OTP)
│   ├── sign-up/[[...sign-up]]/page.tsx     # Clerk Managed Registration
│   └── sso-callback/page.tsx              # OAuth Redirect Handler
├── (dashboard)/
│   ├── layout.tsx                         # Authenticated Shell (Sidebar, Header, Profile Switcher)
│   ├── dashboard/page.tsx                 # Executive Net Worth Command Center
│   ├── assets/
│   │   ├── page.tsx                       # Master Wealth & Asset Register (20+ categories)
│   │   ├── [id]/page.tsx                  # Holding Detail, Transactions, Valuation History
│   │   └── new/page.tsx                   # Manual Asset Entry Modal / Full-Page Form
│   ├── liabilities/
│   │   ├── page.tsx                       # Debt Overview, Total Outstanding, DTI Monitor
│   │   ├── [id]/page.tsx                  # Loan Amortization Schedule, Prepayment Simulator
│   │   └── new/page.tsx                   # Add Loan / Liability Form
│   ├── cashflow/
│   │   ├── page.tsx                       # Monthly Cash Flow, Income vs Expense Trends
│   │   ├── transactions/page.tsx          # Master Ledger, Category Filter, Paired Transfer View
│   │   └── budgets/page.tsx               # Category Spending Limits & 80%/100% Alerts
│   ├── analytics/
│   │   ├── page.tsx                       # Portfolio Analytics (XIRR, CAGR, Allocation)
│   │   ├── performance/page.tsx           # Multi-Year Returns vs NIFTY 50 / S&P 500 Benchmarks
│   │   └── allocation/page.tsx            # Sector, Market-Cap, and Geographic Exposure
│   ├── imports/
│   │   ├── page.tsx                       # Broker Statement Import Center (Groww, INDmoney, CAS)
│   │   ├── [batchId]/preview/page.tsx     # Two-Phase Staging & Conflict Preview Screen
│   │   └── history/page.tsx               # Historical Statement Import Batches & Rollbacks
│   ├── goals/
│   │   ├── page.tsx                       # Financial Goals Register & FIRE Tracker
│   │   └── [id]/page.tsx                  # Goal Feasibility, Linked Holdings, SIP Milestones
│   ├── health/
│   │   └── page.tsx                       # Deterministic Financial Health Scorecard (0–100)
│   ├── advisor/
│   │   └── page.tsx                       # Privacy-Preserving AI Financial Copilot Chat
│   ├── calculators/
│   │   ├── page.tsx                       # Financial Calculators Suite Index
│   │   ├── sip/page.tsx                   # Interactive SIP & Step-Up Calculator
│   │   ├── lumpsum/page.tsx               # Lumpsum Compounding Calculator
│   │   ├── emi/page.tsx                   # Loan EMI & Prepayment Amortization Calculator
│   │   └── fire/page.tsx                  # FIRE Retirement Timeline Projector
│   └── settings/
│       ├── page.tsx                       # User Profile, Display Currency, Privacy Mode
│       ├── profiles/page.tsx              # Multi-Profile Manager (Personal, HUF, Business)
│       ├── accounts/page.tsx              # Financial Accounts Register (Banks, Demats, Cards)
│       └── data/page.tsx                  # Export All JSON/CSV, Purge Account, Danger Zone
├── api/
│   └── v1/                                # RESTful JSON API Route Handlers
│       ├── networth/route.ts
│       ├── assets/route.ts
│       ├── liabilities/route.ts
│       ├── transactions/route.ts
│       ├── accounts/route.ts
│       ├── imports/
│       │   ├── preview/route.ts
│       │   └── commit/route.ts
│       ├── prices/
│       │   ├── sync/route.ts
│       │   └── fx/route.ts
│       ├── ai/
│       │   └── chat/route.ts
│       └── health/route.ts
├── global-error.tsx                       # Root React Error Boundary
├── not-found.tsx                          # Institutional 404 Experience
└── layout.tsx                             # Root HTML, Theme Providers, Inter Font
```

### 6.2 Responsive Layout Standards & Component Design System
- **Viewport Standards:** Fully responsive across Mobile Viewport (360px–640px), Tablet (768px–1024px), Desktop (1280px–1536px), and Ultra-wide (1920px+).
- **Navigation Layout:**
  - *Desktop:* Fixed 260px collapsible sidebar with hierarchical navigation icons, active route indicators, quick-entry action button, and profile switcher. Sticky top header with global search, display currency toggle, privacy mode switch, and Clerk user button.
  - *Mobile:* Collapsible hamburger navigation drawer with bottom sticky navigation bar for core tabs (Dashboard, Assets, Cash Flow, Imports, AI Advisor).
- **Data Table Ergonomics:** Financial tables implement horizontal scroll preservation, sticky header rows, fixed first-column identifiers, and right-aligned numeric data formatted via tabular numbers (`font-variant-numeric: tabular-nums`).

---

## 7. High-Level System Architecture and Topology

### 7.1 Architectural Topology Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                         CLIENT BROWSER LAYER                                       |
|  +-----------------------------------------------------------------------------------------------+ |
|  |                 Next.js 14 App Router (React Server Components + TanStack Query)              | |
|  |  [ Net Worth Hero ]  [ Holdings Register ]  [ Debt Engine ]  [ Import Center ]  [ AI Copilot ]  | |
|  +-----------------------------------------------------------------------------------------------+ |
+--------------------------------------------------┬-------------------------------------------------+
                                                   │ HTTPS / TLS 1.3 (Clerk JWT)
                                                   ▼
+----------------------------------------------------------------------------------------------------+
|                                    VERCEL SERVERLESS / EDGE GATEWAY                                |
|  +-----------------------------------------------------------------------------------------------+ |
|  |  middleware.ts: Clerk JWT Session Verification • Rate Limiting • Security Headers             | |
|  +-----------------------------------------------------------------------------------------------+ |
|  +-----------------------------------------------------------------------------------------------+ |
|  |                                  REST API CONTROLLER LAYER (/api/v1)                          | |
|  |  [ NetWorthController ]  [ AssetController ]  [ ImportController ]  [ AIAdvisorController ]    | |
|  +-----------------------------------------------------------------------------------------------+ |
|  +-----------------------------------------------------------------------------------------------+ |
|  |                                 MODULAR SERVICE ARCHITECTURE                                  | |
|  |  • BalanceSheetService    • DebtEngineService      • ImportStagingService  • PIIAnonymizer    | |
|  |  • MarketPricingService   • ReturnsCalcService     • CashFlowService       • HealthEngine     | |
|  +-----------------------------------------------------------------------------------------------+ |
+-----------------------┬----------------------------------┬-----------------------------------------+
                        │ SQL Connection Pool              │ Redis / REST (5ms)
                        ▼                                  ▼
+--------------------------------------+  +-------------------------------------+
|        PERSISTENT DATABASE           |  |       DISTRIBUTED CACHE LAYER       |
|    PostgreSQL (Supabase / Neon)      |  |          Redis (Upstash)            |
|  • Profiles, Accounts, Assets        |  |  • 15-min Market Price Cache        |
|  • Decimal(19, 4) Precision Ledger   |  |  • 24-hr FX Rate Cache              |
|  • Import Staging & History Tables   |  |  • User Session Rate Limit Buckets  |
|  • Loan Amortization Schedules       |  |  • Rollup Balance Snapshots         |
+--------------------------------------+  +-------------------------------------+
                        │
                        ▼ External Outbound Integrations (Server-to-Server Only)
+----------------------------------------------------------------------------------------------------+
|                                     EXTERNAL THIRD-PARTY PROVIDERS                                 |
|  +--------------------+  +--------------------+  +---------------------+  +---------------------+  |
|  |  Clerk Managed Auth |  | mfapi.in (AMFI)    |  | Yahoo Finance / FX   |  | MiniMax LLM Gateway  |  |
|  |  JWT / OAuth / MFA  |  | Daily Indian NAVs  |  | Stock Quotes & FX   |  | PII-Sanitized AI |  |
|  +--------------------+  +--------------------+  +---------------------+  +---------------------+  |
+----------------------------------------------------------------------------------------------------+
```

### 7.2 Data Flow Architecture & Service Boundaries
1. **Financial Read Path:** Client requests dashboard $\to$ RSC invokes `BalanceSheetService` $\to$ Check Redis for cached net worth rollup $\to$ If stale, query PostgreSQL `Asset` and `Liability` tables $\to$ Apply latest cached FX rates $\to$ Render dashboard.
2. **Statement Ingestion Path:** Client uploads CSV/XLSX/PDF $\to$ Route handler receives `FormData` as in-memory `Uint8Array` $\to$ `ImportStagingService` parses buffer in RAM $\to$ Generate rows in `ImportStagingRow` with conflict tags $\to$ Return preview diff $\to$ User clicks confirm $\to$ Atomic database transaction commits rows to `Asset` table $\to$ RAM buffer garbage collected.
3. **Market Price Refresh Path:** Scheduled Vercel Cron $\to$ `MarketPricingService` queries active tickers $\to$ Polls `mfapi.in` and Yahoo Finance with rate-limit throttling $\to$ Updates Redis cache and `AssetPriceHistory` table $\to$ Triggers background net worth snapshot generation.

---

## 8. Frontend Architecture & Design System

### 8.1 Framework & Core Stack
- **Framework:** Next.js 14.2+ using App Router with React Server Components (RSC) for initial page loads and Client Components (`'use client'`) for interactive forms, sliders, and calculators.
- **Language:** TypeScript 5.x configured with `strict: true`, zero usage of `any`, and strict null checks.
- **Styling:** Vanilla CSS design system powered by Tailwind CSS utility classes and CSS Custom Properties for theme tokens (Light / Dark mode).
- **Component Primitives:** Accessible headless primitives from Radix UI (`@radix-ui/react-*`) styled with Shadcn UI patterns.
- **Data Visualization:** Recharts 2.x for responsive SVG rendering of Net Worth trends, Donut allocations, and Amortization curves.
- **Icons:** Lucide React icons.

### 8.2 State Management Strategy (Server vs. Client State)
- **Server State:** Managed via React Server Components for SSR and **TanStack Query (React Query v5)** on the client for optimistic mutations, automatic background refetching, and cache invalidation upon ledger updates.
- **Client UI State:** Lightweight **Zustand** stores for transient UI state:
  - `usePrivacyStore`: Active privacy mode boolean flag (persisted to `localStorage` and synced to DB).
  - `useCurrencyStore`: Active display currency (`INR` vs `USD`).
  - `useProfileStore`: Active profile context (`profileId`).

### 8.3 Currency Formatting Standard (`en-IN` vs. `en-US`)
FinanceAI implements institutional multi-currency formatting rules respecting regional numbering systems:
- **Indian Rupee (`INR`):** Formatted using locale `en-IN`. Follows the Vedic numbering system (Thousands, Lakhs, Crores):
  - Values $\ge 1,00,00,000$: Formatted as Crores (`₹1.25 Cr`).
  - Values $\ge 1,00,000$: Formatted as Lakhs (`₹4.50 L`).
  - Values $< 1,00,000$: Standard Indian grouping (`₹95,400.00`).
- **Global Currencies (`USD`, `EUR`, `GBP`):** Formatted using locale `en-US`. Follows standard international grouping (Thousands, Millions, Billions):
  - Values $\ge 1,000,000,000$: Formatted as Billions (`$1.20 B`).
  - Values $\ge 1,000,000$: Formatted as Millions (`$3.45 M`).
  - Values $< 1,000,000$: Standard grouping (`$12,450.00`).
- **Tabular Alignment:** All numerical display elements utilize `font-mono font-tabular-nums` to guarantee vertical decimal alignment across data tables.

### 8.4 Component Hierarchy & Design Tokens
- **Theme Variables:** CSS custom properties define semantic tokens:
  - `--background`, `--foreground`, `--card`, `--card-foreground`
  - `--primary` (Institutional Navy / Emerald for positive returns)
  - `--destructive` (Muted Crimson for liabilities and losses)
  - `--muted`, `--accent`, `--border`, `--radius`
- **Accessibility:** Meets WCAG 2.1 Level AA compliance, supporting screen readers, keyboard focus management, and minimum 4.5:1 contrast ratios.

---

## 9. Backend and Service Architecture

### 9.1 API Controller Layer & Middleware
- **Edge Middleware (`middleware.ts`):**
  - Intercepts incoming HTTP requests.
  - Validates Clerk session JWT. Redirects unauthenticated requests to `/sign-in`.
  - Sets security headers: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`.
- **API Route Handlers (`app/api/v1/*`):**
  - Extract authenticated `userId` via `@clerk/nextjs/server`.
  - Parse and validate incoming query parameters and JSON payloads using strict **Zod** schemas.
  - Return standardized HTTP responses: `{ success: true, data: ... }` or `{ success: false, error: { code, message, details } }`.

### 9.2 Modular Service Architecture & Ownership Matrix

| Service Class | File Path | Functional Responsibility |
|---|---|---|
| **`BalanceSheetService`** | `src/services/balance-sheet.service.ts` | Aggregates user assets and liabilities; executes immediate net worth recalculation; computes historical net worth trajectories. |
| **`AssetService`** | `src/services/asset.service.ts` | Manages asset CRUD operations, holding cost-basis tracking, quantity updates, and asset class categorization. |
| **`DebtEngineService`** | `src/services/debt-engine.service.ts` | Calculates loan EMI, generates full monthly amortization schedules, models prepayments, compares Snowball vs. Avalanche strategies. |
| **`CashFlowService`** | `src/services/cashflow.service.ts` | Handles income and expense transactions, category assignments, and executes atomic double-entry paired transfers. |
| **`ImportStagingService`** | `src/services/import-staging.service.ts` | Manages two-phase statement staging; coordinates ephemeral broker parsing; detects conflicts; commits validated batches. |
| **`MarketPricingService`** | `src/services/market-pricing.service.ts` | Fetches NAVs from `mfapi.in` and quotes from Yahoo Finance; manages multi-tier caching (Redis + In-memory); handles provider fallbacks. |
| **`FXConversionService`** | `src/services/fx-conversion.service.ts` | Manages foreign exchange rates (USD/INR, EUR/INR); executes currency normalization; performs triangular cross-currency conversions. |
| **`ReturnsCalcService`** | `src/services/returns-calc.service.ts` | Executes deterministic financial algorithms: XIRR (Newton-Raphson/Bisection), CAGR, Absolute Return, and benchmark comparisons. |
| **`FinancialHealthService`** | `src/services/financial-health.service.ts` | Pure deterministic evaluation of the 4-pillar Financial Health Score (Emergency Fund, DTI, Savings Rate, Net Worth Multiple). |
| **`AIAdvisorService`** | `src/services/ai-advisor.service.ts` | Assembles financial metrics context; scrubs PII; interfaces with MiniMax LLM API; enforces structured JSON output contracts. |

---

## 10. Target Domain Model, Schema Specification, and Migration Strategy

### 10.1 Database Entity Relationship Architecture
The database is built on **PostgreSQL** using **Prisma ORM**. To resolve the architectural deficiencies of the current flat schema, the target data model introduces:
1. **`Profile` Model:** Multi-profile isolation under each user account (Personal, HUF, Business).
2. **`Account` Model:** Explicit financial accounts (HDFC Savings, Zerodha Demat, ICICI Credit Card) linking assets and transactions.
3. **`Decimal(19, 4)` Precision:** Full financial precision across all monetary amounts, eliminating IEEE 754 floating-point rounding errors.
4. **`LoanAmortizationSchedule` Model:** Persistent amortization schedule records.
5. **`ImportBatch` & `ImportStagingRow` Models:** Persistent two-phase statement staging tables.
6. **`AssetPriceHistory` & `FXRate` Models:** Persistent historical market price and currency exchange records.
7. **Paired Transfer Fields:** `transferGroupId` and `destinationAccountId` on `Transaction`.
8. **Scoped Deduplication:** Unique constraints scoped to `[userId, accountId, importKey]`.

### 10.2 Complete Production Target Prisma Schema (`prisma/schema.prisma`)

```prisma
// FinanceAI — Production Target Prisma Schema (PostgreSQL)
// Enforces Decimal(19, 4) financial precision, multi-profile isolation, and two-phase import staging.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────────────────────────────────
// USER & MULTI-PROFILE DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

model User {
  id              String        @id @default(cuid())
  clerkId         String?       @unique
  email           String        @unique
  name            String?
  baseCurrency    String        @default("INR") // Primary base currency (INR, USD)
  privacyMode     Boolean       @default(false)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  profiles        Profile[]
  accounts        Account[]
  assets          Asset[]
  transactions    Transaction[]
  liabilities     Liability[]
  goals           Goal[]
  budgets         Budget[]
  snapshots       Snapshot[]
  allocationTargets AllocationTarget[]
  importBatches   ImportBatch[]
  aiConversations AIConversation[]

  @@index([email])
  @@index([clerkId])
}

// Multi-profile isolation (Personal, Family/HUF, Business)
model Profile {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String        // e.g., "Personal", "Family HUF", "Consulting LLC"
  type            String        @default("PERSONAL") // PERSONAL | FAMILY | BUSINESS
  isDefault       Boolean       @default(false)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  accounts        Account[]
  assets          Asset[]
  transactions    Transaction[]
  liabilities     Liability[]
  snapshots       Snapshot[]

  @@unique([userId, name])
  @@index([userId])
}

// Financial institutions & accounts (Savings, Demat, Credit Cards, Wallets)
model Account {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  profileId       String
  profile         Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  institutionName String        // e.g., "HDFC Bank", "Zerodha", "INDmoney", "SBI"
  accountName     String        // e.g., "Primary Salary Account", "Groww Trading"
  accountType     String        // SAVINGS | CHECKING | DEMAT | CREDIT_CARD | WALLET | LOAN
  accountNumber   String?       // Masked: e.g., "••••4321"
  currency        String        @default("INR")
  currentBalance  Decimal       @default(0.0000) @db.Decimal(19, 4)
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  assets          Asset[]
  transactions    Transaction[]
  importBatches   ImportBatch[]

  @@index([userId, profileId])
}

// ─────────────────────────────────────────────────────────────────────────────
// WEALTH & ASSET MANAGEMENT DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

model Asset {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  profileId       String
  profile         Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  accountId       String?
  account         Account?      @relation(fields: [accountId], references: [id], onDelete: SetNull)

  type            String        // STOCK | MUTUAL_FUND | FIXED_DEPOSIT | EPF | PPF | REAL_ESTATE | GOLD | CRYPTO | CASH
  assetClass      String        @default("EQUITY") // EQUITY | FIXED_INCOME | COMMODITY | REAL_ESTATE | ALTERNATIVE | CASH
  name            String
  symbol          String?       // Market ticker: e.g., "RELIANCE.NS", "AAPL", "BTC-USD"
  isin            String?       // Regulatory security ID: e.g., "INE002A01018"
  exchange        String?       // NSE | BSE | NASDAQ | NYSE
  folio           String?       // Mutual fund folio number

  quantity        Decimal       @db.Decimal(18, 6) // Supports fractional shares & crypto
  avgBuyPrice     Decimal       @db.Decimal(19, 4) // Cost basis in asset currency
  currentPrice    Decimal       @db.Decimal(19, 4) // Latest known market price
  currency        String        @default("INR")    // Native currency of the asset

  importSource    String?       // MANUAL | GROWW | INDMONEY | CAS_PDF | ZERODHA
  importKey       String?       // Scoped identity: "<BROKER>|<CLASS>|<IDENTITY>"
  priceSource     String?       // YAHOO | MFAPI | STATEMENT | MANUAL | COST_BASIS
  priceUpdatedAt  DateTime?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  deletedAt       DateTime?     // Soft deletion support for statement snapshot syncing

  goalLinks       GoalAssetLink[]

  // Deduplication scoped per user, account, and import identity
  @@unique([userId, accountId, importKey])
  @@index([userId, profileId])
  @@index([userId, type])
  @@index([userId, deletedAt])
  @@index([isin])
  @@index([symbol])
}

model AssetPriceHistory {
  id              String        @id @default(cuid())
  identifier      String        // ISIN or Symbol (e.g., "INE002A01018" or "AAPL")
  date            DateTime      @db.Date
  closePrice      Decimal       @db.Decimal(19, 4)
  currency        String        @default("INR")
  source          String        // MFAPI | YAHOO | NSE
  createdAt       DateTime      @default(now())

  @@unique([identifier, date])
  @@index([identifier, date])
}

model FXRate {
  id              String        @id @default(cuid())
  fromCurrency    String        // e.g., "USD"
  toCurrency      String        // e.g., "INR"
  rate            Decimal       @db.Decimal(19, 6)
  date            DateTime      @db.Date
  source          String        @default("YAHOO")
  createdAt       DateTime      @default(now())

  @@unique([fromCurrency, toCurrency, date])
  @@index([fromCurrency, toCurrency, date])
}

// ─────────────────────────────────────────────────────────────────────────────
// LIABILITIES & DEBT AMORTIZATION DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

model Liability {
  id                String        @id @default(cuid())
  userId            String
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  profileId         String
  profile           Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)

  type              String        // HOME_LOAN | AUTO_LOAN | PERSONAL_LOAN | EDUCATION_LOAN | CREDIT_CARD | LAP | OTHER
  name              String        // e.g., "HDFC Home Loan"
  lenderName        String?       // e.g., "HDFC Bank"
  principalAmount   Decimal       @db.Decimal(19, 4)
  outstandingAmount Decimal       @db.Decimal(19, 4)
  interestRate      Decimal       @db.Decimal(6, 4)  // e.g., 8.5000%
  tenureMonths      Int?          // Total tenure in months
  remainingMonths   Int?          // Remaining tenure in months
  monthlyEMI        Decimal       @db.Decimal(19, 4)
  startDate         DateTime?
  dueDate           DateTime?
  currency          String        @default("INR")

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  deletedAt         DateTime?

  schedules         LoanAmortizationSchedule[]

  @@index([userId, profileId])
}

model LoanAmortizationSchedule {
  id              String        @id @default(cuid())
  liabilityId     String
  liability       Liability     @relation(fields: [liabilityId], references: [id], onDelete: Cascade)
  monthNumber     Int           // 1, 2, ..., n
  paymentDate     DateTime      @db.Date
  emiAmount       Decimal       @db.Decimal(19, 4)
  principalPaid   Decimal       @db.Decimal(19, 4)
  interestPaid    Decimal       @db.Decimal(19, 4)
  remainingBalance Decimal      @db.Decimal(19, 4)
  isPaid          Boolean       @default(false)
  createdAt       DateTime      @default(now())

  @@unique([liabilityId, monthNumber])
  @@index([liabilityId, paymentDate])
}

// ─────────────────────────────────────────────────────────────────────────────
// CASH FLOW & DOUBLE-ENTRY TRANSACTIONS DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

model Transaction {
  id                  String        @id @default(cuid())
  userId              String
  user                User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  profileId           String
  profile             Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  accountId           String?
  account             Account?      @relation(fields: [accountId], references: [id], onDelete: SetNull)

  type                String        // INCOME | EXPENSE | TRANSFER
  amount              Decimal       @db.Decimal(19, 4)
  currency            String        @default("INR")
  category            String        // Food, Housing, Investment, Salary, etc.
  description         String?
  date                DateTime

  // Paired transfer support
  transferGroupId     String?       // Unique UUID shared by debit and credit transfer legs
  destinationAccountId String?      // Target account pointer for transfers

  dedupHash           String?       // Deterministic hash: SHA256(date + amount + desc + accountId)
  tags                String        @default("[]") // JSON string array
  createdAt           DateTime      @default(now())
  deletedAt           DateTime?

  @@index([userId, profileId, date])
  @@index([userId, category])
  @@index([transferGroupId])
  @@unique([userId, accountId, dedupHash])
}

model Budget {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  category        String
  monthlyLimit    Decimal       @db.Decimal(19, 4)
  month           Int           // 1 - 12
  year            Int           // e.g., 2026
  alertAt80       Boolean       @default(true)
  alertAt100      Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([userId, category, month, year])
  @@index([userId, year, month])
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT PIPELINE & STAGING DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

model ImportBatch {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId       String?
  account         Account?      @relation(fields: [accountId], references: [id], onDelete: SetNull)

  broker          String        // GROWW | INDMONEY | CAS_PDF | MANUAL
  assetClass      String        // IN_STOCK | US_STOCK | IN_MUTUAL_FUND
  fileName        String
  fileHash        String        // SHA-256 hash of uploaded file content
  status          String        @default("STAGED") // STAGED | COMMITTED | REJECTED | ROLLED_BACK
  replaceMissing  Boolean       @default(true)     // Snapshot sync behavior

  totalRows       Int           @default(0)
  validRows       Int           @default(0)
  errorRows       Int           @default(0)
  issues          String        @default("[]")     // JSON array of parser warnings/errors

  createdAt       DateTime      @default(now())
  committedAt     DateTime?

  stagingRows     ImportStagingRow[]

  @@index([userId, status])
}

model ImportStagingRow {
  id              String        @id @default(cuid())
  batchId         String
  batch           ImportBatch   @relation(fields: [batchId], references: [id], onDelete: Cascade)
  sourceRowNumber Int
  status          String        @default("PENDING") // PENDING | VALID | CONFLICT | ERROR | EXCLUDED

  assetType       String        // STOCK | MUTUAL_FUND
  name            String
  symbol          String?
  isin            String?
  folio           String?
  quantity        Decimal       @db.Decimal(18, 6)
  averagePrice    Decimal       @db.Decimal(19, 4)
  statementPrice  Decimal?      @db.Decimal(19, 4)
  investedValue   Decimal       @db.Decimal(19, 4)
  currency        String        @default("INR")
  importKey       String        // Scoped identity

  conflictType    String?       // NONE | QUANTITY_CHANGE | NEW_HOLDING | MISSING_FROM_STATEMENT
  validationError String?
  isSelected      Boolean       @default(true)      // User selection gate

  createdAt       DateTime      @default(now())

  @@index([batchId, status])
}

// ─────────────────────────────────────────────────────────────────────────────
// GOALS, PLANNING & HISTORICAL ANALYTICS DOMAIN
// ─────────────────────────────────────────────────────────────────────────────

model Goal {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String        // e.g., "Child Higher Education", "Retirement FIRE"
  targetAmount    Decimal       @db.Decimal(19, 4)
  currentAmount   Decimal       @default(0.0000) @db.Decimal(19, 4)
  targetDate      DateTime
  expectedReturn  Decimal       @default(0.1200) @db.Decimal(6, 4) // 12% p.a.
  monthlyRequired Decimal       @default(0.0000) @db.Decimal(19, 4)
  status          String        @default("ACTIVE") // ACTIVE | COMPLETED | PAUSED
  priority        String        @default("MEDIUM") // HIGH | MEDIUM | LOW
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  assetLinks      GoalAssetLink[]

  @@index([userId, status])
}

model GoalAssetLink {
  id              String        @id @default(cuid())
  goalId          String
  goal            Goal          @relation(fields: [goalId], references: [id], onDelete: Cascade)
  assetId         String
  asset           Asset         @relation(fields: [assetId], references: [id], onDelete: Cascade)
  allocatedPct    Decimal       @default(1.0000) @db.Decimal(5, 4) // 100% allocation by default

  @@unique([goalId, assetId])
  @@index([goalId])
  @@index([assetId])
}

model Snapshot {
  id               String       @id @default(cuid())
  userId           String
  user             User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  profileId        String?
  profile          Profile?     @relation(fields: [profileId], references: [id], onDelete: Cascade)
  date             DateTime     @db.Date
  totalAssets      Decimal      @db.Decimal(19, 4)
  totalLiabilities Decimal      @db.Decimal(19, 4)
  netWorth         Decimal      @db.Decimal(19, 4)
  currency         String       @default("INR")
  breakdown        String       @default("{}") // JSON string of asset/liability categorization
  createdAt        DateTime     @default(now())

  @@unique([userId, date, profileId])
  @@index([userId, date])
}

model AllocationTarget {
  id            String          @id @default(cuid())
  userId        String
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  assetClass    String          // EQUITY | FIXED_INCOME | GOLD | REAL_ESTATE | CASH
  targetPercent Decimal         @db.Decimal(5, 4) // e.g., 0.6000 for 60%

  @@unique([userId, assetClass])
}

model AIConversation {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  action          String        // PORTFOLIO_ANALYSIS | DEBT_PAYOFF_PLAN | BUDGET_ADVICE | CUSTOM_CHAT
  messages        String        @default("[]") // JSON string of sanitized message history
  contextSnapshot String        @default("{}") // JSON string of deterministic metrics provided
  createdAt       DateTime      @default(now())

  @@index([userId, createdAt])
}
```

### 10.3 Schema Migration, Backfill, Compatibility, and Recovery Plan

Executing the transition from the current flat schema to the production target schema requires a zero-downtime, non-destructive 4-step migration sequence:

#### Step 1: Pre-Migration Validation & Database Snapshot
- Execute a full physical backup (`pg_dump`) of the production PostgreSQL database.
- Verify existing record counts: `SELECT COUNT(*) FROM "User";`, `"Asset"`, `"Transaction"`, `"Liability"`.
- Verify that no orphan foreign keys or NULL constraints exist.

#### Step 2: DDL Migration (Forward Compatible)
- Deploy Prisma migration script creating the new tables (`Profile`, `Account`, `ImportBatch`, `ImportStagingRow`, `LoanAmortizationSchedule`, `AssetPriceHistory`, `FXRate`, `GoalAssetLink`).
- Add nullable foreign keys: `profileId` on `Asset`, `Transaction`, `Liability`, `Snapshot`; `accountId` on `Asset` and `Transaction`.
- Add `transferGroupId`, `destinationAccountId`, and `dedupHash` to `Transaction`.

#### Step 3: Data Backfill & Precision Casting
- **Default Profile Creation:** For every existing `User`, generate a default `Profile` record with `name = 'Personal'`, `type = 'PERSONAL'`, and `isDefault = true`.
- **Foreign Key Association:** Update all existing `Asset`, `Transaction`, and `Liability` rows, setting `profileId` to the user's newly created default `Profile.id`.
- **Numeric Precision Migration:** Execute SQL `ALTER TABLE` statements casting columns from IEEE `double precision` (`Float`) to `DECIMAL(19, 4)` and `DECIMAL(18, 6)`:
  ```sql
  ALTER TABLE "Asset" 
    ALTER COLUMN "quantity" TYPE DECIMAL(18, 6) USING "quantity"::DECIMAL(18, 6),
    ALTER COLUMN "avgBuyPrice" TYPE DECIMAL(19, 4) USING "avgBuyPrice"::DECIMAL(19, 4),
    ALTER COLUMN "currentPrice" TYPE DECIMAL(19, 4) USING "currentPrice"::DECIMAL(19, 4);

  ALTER TABLE "Transaction" 
    ALTER COLUMN "amount" TYPE DECIMAL(19, 4) USING "amount"::DECIMAL(19, 4);

  ALTER TABLE "Liability" 
    ALTER COLUMN "principalAmount" TYPE DECIMAL(19, 4) USING "principalAmount"::DECIMAL(19, 4),
    ALTER COLUMN "outstandingAmount" TYPE DECIMAL(19, 4) USING "outstandingAmount"::DECIMAL(19, 4),
    ALTER COLUMN "interestRate" TYPE DECIMAL(6, 4) USING "interestRate"::DECIMAL(6, 4);
  ```
- **Deduplication Hash Population:** Backfill `dedupHash` for historical transactions using `MD5(date::text || amount::text || COALESCE(description, '') || userId)`.

#### Step 4: Constraints Enforcement & Verification
- Enforce `NOT NULL` on `profileId` across all models.
- Apply new scoped unique constraints: `@@unique([userId, accountId, importKey])` and `@@unique([userId, accountId, dedupHash])`.
- Validate that all application queries execute without schema mismatches.

#### Rollback & Recovery Strategy
- If migration fails during step 2 or 3, execute the rollback script dropping the newly added nullable columns and tables.
- If data corruption occurs during decimal casting, restore PostgreSQL from the step 1 `pg_dump` archive and restart in maintenance mode.

### 10.4 Compound Uniqueness, Deduplication Scoping, and Transfer Pairing
- **Resolution of Deduplication Bug:** The current codebase schema specifies `@@unique([userId, importKey])`. Because `accountId` is absent, a user who holds Reliance stock in Zerodha and the same stock in Groww experiences a unique constraint collision! The target schema solves this by enforcing `@@unique([userId, accountId, importKey])`, properly scoping holdings by financial account.
- **Handling Nullable Account IDs:** For manual assets that lack an explicit account, the database stores a sentinel `DEFAULT_ACCOUNT` reference or leverages PostgreSQL partial unique indexes (`WHERE "accountId" IS NOT NULL`).
- **Paired Transfer Integrity:** Transfers are created within an atomic Prisma transaction (`prisma.$transaction`), writing both the debit leg and credit leg with an identical `transferGroupId`. If either leg fails, the entire transfer rolls back, ensuring zero balance drift.



## 11. API Route and Service Contract Reference

### 11.1 Complete RESTful API Specifications & Payload Schemas
All endpoints require valid Clerk Bearer JWT authentication and reside under `/api/v1/`. Responses follow standard JSON envelopes: `{ "success": true, "data": { ... } }` or `{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }`.

#### 1. Executive Net Worth (`GET /api/v1/networth`)
- **Query Parameters:** `profileId` (optional string), `currency` (optional string: `INR` | `USD`, default `INR`), `period` (optional string: `1M` | `3M` | `6M` | `1Y` | `YTD` | `ALL`, default `1Y`).
- **Response Payload:**
```json
{
  "success": true,
  "data": {
    "netWorth": 12540000.50,
    "totalAssets": 18540000.50,
    "totalLiabilities": 6000000.00,
    "currency": "INR",
    "changePeriod": "1M",
    "absoluteChange": 345000.00,
    "percentageChange": 2.83,
    "assetAllocation": [
      { "category": "EQUITY", "value": 11000000.00, "percentage": 59.33 },
      { "category": "FIXED_INCOME", "value": 4540000.50, "percentage": 24.49 },
      { "category": "REAL_ESTATE", "value": 2000000.00, "percentage": 10.79 },
      { "category": "CASH", "value": 1000000.00, "percentage": 5.39 }
    ],
    "liabilityBreakdown": [
      { "type": "HOME_LOAN", "outstanding": 5500000.00, "percentage": 91.67 },
      { "type": "AUTO_LOAN", "outstanding": 500000.00, "percentage": 8.33 }
    ],
    "history": [
      { "date": "2026-09-01", "netWorth": 12195000.50 },
      { "date": "2026-10-01", "netWorth": 12540000.50 }
    ]
  }
}
```

#### 2. Asset Management (`GET /api/v1/assets`, `POST /api/v1/assets`)
- **`POST /api/v1/assets` Request Payload:**
```json
{
  "profileId": "prof_12345",
  "accountId": "acc_67890",
  "type": "STOCK",
  "assetClass": "EQUITY",
  "name": "Reliance Industries Ltd",
  "symbol": "RELIANCE.NS",
  "isin": "INE002A01018",
  "exchange": "NSE",
  "quantity": 50,
  "avgBuyPrice": 2850.50,
  "currentPrice": 2980.00,
  "currency": "INR",
  "importSource": "MANUAL"
}
```
- **`POST /api/v1/assets` Response (HTTP 201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "ast_998877",
    "name": "Reliance Industries Ltd",
    "symbol": "RELIANCE.NS",
    "quantity": 50,
    "investedValue": 142525.00,
    "currentValue": 149000.00,
    "unrealizedGain": 6475.00,
    "unrealizedGainPct": 4.54,
    "createdAt": "2026-10-09T12:00:00Z"
  }
}
```

#### 3. Liabilities & Amortization (`GET /api/v1/liabilities/[id]/schedule`)
- **Response Payload:**
```json
{
  "success": true,
  "data": {
    "liabilityId": "lia_554433",
    "loanName": "HDFC Home Loan",
    "principal": 5000000.00,
    "interestRate": 8.50,
    "tenureMonths": 240,
    "monthlyEMI": 43391.17,
    "totalInterest": 5413880.80,
    "schedule": [
      {
        "monthNumber": 1,
        "paymentDate": "2026-11-01",
        "emiAmount": 43391.17,
        "principalPaid": 7974.50,
        "interestPaid": 35416.67,
        "remainingBalance": 4992025.50
      }
    ]
  }
}
```

#### 4. Paired Transfers (`POST /api/v1/transactions/transfer`)
- **Request Payload:**
```json
{
  "profileId": "prof_12345",
  "sourceAccountId": "acc_savings_01",
  "destinationAccountId": "acc_trading_02",
  "amount": 50000.00,
  "currency": "INR",
  "date": "2026-10-09T10:00:00Z",
  "description": "Funds transfer to Zerodha for equity investments"
}
```
- **Response Payload (HTTP 201 Created):**
```json
{
  "success": true,
  "data": {
    "transferGroupId": "trg_88776655",
    "debitTransaction": {
      "id": "txn_debit_01",
      "accountId": "acc_savings_01",
      "amount": -50000.00,
      "type": "TRANSFER",
      "newAccountBalance": 150000.00
    },
    "creditTransaction": {
      "id": "txn_credit_02",
      "accountId": "acc_trading_02",
      "amount": 50000.00,
      "type": "TRANSFER",
      "newAccountBalance": 75000.00
    }
  }
}
```

#### 5. Statement Imports (`POST /api/v1/imports/preview`, `POST /api/v1/imports/commit`)
- **`POST /api/v1/imports/preview` Request:** `multipart/form-data` with fields: `file` (Binary), `broker` (`GROWW` | `INDMONEY` | `CAS_PDF`), `assetClass` (`IN_STOCK` | `IN_MUTUAL_FUND` | `US_STOCK`), `accountId` (string), `password` (optional string for CAS PDF).
- **`POST /api/v1/imports/preview` Response (HTTP 200 OK):**
```json
{
  "success": true,
  "data": {
    "batchId": "imp_batch_101",
    "broker": "GROWW",
    "assetClass": "IN_MUTUAL_FUND",
    "fileName": "groww_mf_oct2026.xlsx",
    "totalRows": 14,
    "validRows": 14,
    "errorRows": 0,
    "stagingRows": [
      {
        "id": "stg_row_01",
        "name": "Parag Parikh Flexi Cap Fund Direct-Growth",
        "isin": "INF879O01018",
        "folio": "1234567/89",
        "quantity": 1250.450,
        "averagePrice": 62.40,
        "statementPrice": 78.50,
        "investedValue": 78028.08,
        "conflictType": "NEW_HOLDING",
        "isSelected": true
      }
    ],
    "summaryPlan": {
      "toCreate": 12,
      "toUpdate": 2,
      "toSoftDelete": 0
    }
  }
}
```

#### 6. AI Financial Advisory Gateway (`POST /api/v1/ai/chat`)
- **Request Payload:**
```json
{
  "message": "Based on my current loans and monthly income, should I prioritize paying off my car loan early or invest more in mutual funds?",
  "conversationId": "conv_443322"
}
```
- **Response Payload:**
```json
{
  "success": true,
  "data": {
    "reply": "Analyzing your financial profile: Your car loan has an interest rate of 9.20% with ₹4,50,000 outstanding (EMI: ₹12,500). Your debt-to-income ratio is currently 28%, which is within a healthy range. However, guaranteed post-tax savings of 9.20% by prepaying the car loan provides an immediate risk-free return that exceeds conservative fixed-income options...",
    "metricsAnalyzed": {
      "netWorth": "₹1.25 Cr",
      "dtiRatio": "28%",
      "monthlySavings": "₹45,000",
      "highestInterestDebt": "9.20% (Car Loan)"
    },
    "disclaimer": "This analysis is for educational purposes only and does not constitute SEBI/SEC registered financial advice."
  }
}
```

---

## 12. Import Pipeline and Broker Format Engine

### 12.1 6-Stage Ephemeral Import Pipeline
The import engine enforces institutional zero-trust security and idempotent reconciliation across a 6-stage lifecycle:

```
[ Stage 1: Upload & Ephemeral Ingestion ]
  User uploads file via Next.js FormData. Buffer is loaded into RAM (Uint8Array).
  Zero persistence to disk, /tmp, or cloud object storage.
          │
          ▼
[ Stage 2: Security & Decryption Gateway ]
  Checks magic bytes (ZIP for .xlsx, D0CF11E0 for legacy .xls, %PDF- for PDF).
  If PDF, invokes in-memory pdfjs-dist with user-supplied password (PAN/DOB).
          │
          ▼
[ Stage 3: Adapter Parsing & Extraction ]
  Executes specific broker adapter (Groww, INDmoney, CAS).
  Tokenizes rows, identifies header offset dynamically, extracts ISIN, folio, qty, price.
          │
          ▼
[ Stage 4: Normalization & Conflict Analysis ]
  Generates deterministic importKey: "<BROKER>|<ASSET_CLASS>|<IDENTITY>".
  Queries existing holdings for [userId, accountId, importKey].
  Flags conflicts: NEW_HOLDING, QUANTITY_CHANGE, PRICE_CHANGE, MISSING_FROM_STATEMENT.
          │
          ▼
[ Stage 5: Database Staging & User Preview ]
  Writes parsed rows to ImportBatch and ImportStagingRow with status "STAGED".
  UI presents interactive diff preview table. User can deselect or adjust rows.
          │
          ▼
[ Stage 6: Atomic Commit & Ledger Synchronization ]
  Prisma transaction commits accepted rows to Asset table.
  If replaceMissing=true, soft-deletes unmentioned holdings for that broker/asset class.
  Clears in-memory buffers immediately.
```

### 12.2 Indian CAS (CAMS / KFintech) Parser Rules & Ephemeral Decryption
- **Password Decryption Logic:** Regulatory CAS PDFs are password-protected by default. The standard password format mandated by CAMS/KFintech is:
  - Format 1: User's 10-character uppercase PAN (e.g., `ABCDE1234F`).
  - Format 2: PAN + Date of Birth (`DDMMYYYY`).
  - Format 3: Lowercase PAN.
- **Parsing Rules:**
  - Tokenizes text streams looking for folio section headers (`Folio No:`), Scheme names (`ISIN:`), and transaction tables (`Date`, `Transaction Description`, `Amount`, `Units`, `Price`, `Unit Balance`).
  - Parses opening unit balance, purchase transactions, redemptions, dividend reinvestments, and closing unit balance.
  - Generates distinct holdings per unique combination of `ISIN + Folio`.
- **Ephemeral Rule:** Decrypted PDF text strings are cleared from memory as soon as staging rows are created. Under no circumstances is the unencrypted PDF or password logged.

### 12.3 Groww and INDmoney Adapter Execution Rules

#### Groww Adapters (`groww-stock.adapter.ts`, `groww-mutualfund.adapter.ts`)
- **Stocks:**
  - Identifies header row by scanning for columns: `Stock name`, `ISIN`, `Quantity`, `Avg price`, `Invested value`, `Current value`.
  - Rejects files lacking `ISIN` column with a descriptive error: `"Missing required column 'ISIN'. Please export holding report directly from Groww web or app."`
  - Derives `importKey` as `GROWW|IN_STOCK|${isin}`.
- **Mutual Funds:**
  - Identifies header row with `Scheme Name`, `Folio No.`, `Units`, `Avg NAV`, `Invested`, `Current Value`.
  - Preserves statement NAV as fallback when market data API is unreachable.
  - Derives `importKey` as `GROWW|IN_MUTUAL_FUND|${isin}|${folio}`.

#### INDmoney Adapters (`indmoney-usstock.adapter.ts`, `indmoney-mutualfund.adapter.ts`)
- **US Stocks:**
  - Supports binary `.xls` (BIFF8) and modern `.xlsx`.
  - Verifies presence of USD currency indicator in header (`Total Value ($)` or `Price ($)`). If missing, rejects file to prevent currency corruption.
  - Preserves fractional share precision up to 6 decimal places.
  - Derives `importKey` as `INDMONEY|US_STOCK|${symbol}`.
- **Mutual Funds:**
  - Parses ISIN and folio number.
  - Derives `importKey` as `INDMONEY|IN_MUTUAL_FUND|${isin}|${folio}`.

#### Rejection of Unsupported Formats
- If user uploads INDmoney Indian Stocks export, the adapter detects headers and returns an explicit, user-friendly error:
  `"INDmoney Indian Stocks format is not currently supported. Please use Groww or CAS PDF for Indian equities."`

### 12.4 Staging, Preview, Conflict Resolution, and Idempotent Commit
- **Preview Isolation:** Generating a preview never modifies user assets or account balances. If a file contains corrupted rows or invalid numbers, preview presents row-level error badges while allowing valid rows to proceed.
- **Idempotency Guarantee:** Importing the identical file twice consecutively yields 0 additions, 0 deletions, and updates 0 quantities.
- **Reconciliation Mode (`replaceMissing`):**
  - `replaceMissing: true` (Full Snapshot Mode): Holdings in the database belonging to the same `userId + accountId + broker + assetClass` that are **absent** in the new statement are marked `deletedAt = now()` (soft-deleted). Re-appearing holdings on subsequent imports are revived (`deletedAt = null`).
  - `replaceMissing: false` (Additive Mode): Missing holdings remain untouched.
- **Safety Gate:** If any row in the statement has a critical parsing error, the `replaceMissing` deletion phase is automatically disabled to prevent corrupted statements from erroneously deleting user portfolios.

---

## 13. Market Price Engine, NAV Sync, and Multi-Currency FX Pipeline

### 13.1 Market Data Architecture: Polling / EOD vs. Real-Time Tick Feeds
It is a critical architectural requirement to eliminate technical ambiguity regarding market pricing:
- **No Sub-Second WebSockets:** FinanceAI is a wealth tracker and portfolio analytics platform, **NOT** an intra-day trading terminal. Sub-second WebSocket streaming tickers are an explicit non-goal.
- **Polling & EOD Model:**
  - Indian Mutual Funds: Updated once daily at End-of-Day (EOD).
  - Indian & US Equities: 15-minute delayed quotes during market hours; EOD closing prices outside market hours.
  - Foreign Exchange (FX): Polled once every 24 hours.

### 13.2 NAV & Stock Quote Fetching Strategy & Multi-Tier Fallbacks
The market pricing service employs a resilient 3-tier fallback architecture:

```
[ Tier 1: Open / Free REST Feeds ]
  • Indian Mutual Funds: https://api.mfapi.in/mf/{schemeCode} (AMFI Open API)
  • Indian Equities: Yahoo Finance API (e.g., RELIANCE.NS, TCS.NS)
  • US Equities & Crypto: Yahoo Finance API (e.g., AAPL, MSFT, BTC-USD)
          │
          ▼ (On Network Failure or Rate Limit 429)
[ Tier 2: Statement Price Fallback ]
  • Preserves the latest market price or NAV extracted from the broker statement export.
  • Prevents portfolio valuation from dropping to zero when third-party APIs are down.
          │
          ▼ (On Missing Statement Price)
[ Tier 3: Cost Basis Fallback ]
  • Uses average purchase price (avgBuyPrice) as the provisional valuation.
  • Flags holding with priceSource = 'COST_BASIS' and prompts user to enter price manually.
```

### 13.3 Multi-Currency FX Pipeline & Triangular Conversion
- **Base FX Pairs:** Daily scheduled sync fetches `USD/INR`, `EUR/INR`, and `GBP/INR` rates from Yahoo Finance and persists them in the `FXRate` table.
- **Triangular Conversion:** For less common currency pairs (e.g., `EUR` to `CAD`), the engine performs triangular cross-currency conversion:
  $$\text{Rate}(EUR \to CAD) = \frac{\text{Rate}(EUR \to USD)}{\text{Rate}(CAD \to USD)}$$
- **Stale Cache Tolerance:** If external FX providers fail, the system falls back to the most recent persisted rate in `FXRate` with a warning banner indicating quotes are using yesterday's exchange rates.

### 13.4 Market Data Freshness vs. Immediate Net Worth Recalculation
To resolve inconsistencies in financial state management, the system strictly separates two concepts:
1. **Immediate Net Worth Recalculation (Synchronous):** When a user enters a transaction, updates cash balances, or adds an asset, the net worth rollup engine recalculates totals **immediately and synchronously**. This operation is pure CPU math and requires zero external network calls.
2. **Market Data Freshness (Asynchronous):** The updating of asset unit prices (NAVs, stock quotes) is asynchronous, governed by the 15-minute Redis cache TTL and daily cron refresh jobs. A user can trigger an on-demand market price sync via the *"Refresh Prices"* button in the UI.

---

## 14. AI Advisory and Deterministic Financial Engines

### 14.1 Decoupled AI Architecture (Deterministic Core First, LLM Second)
To prevent hallucinations and guarantee 100% mathematical precision, **LLMs are never tasked with calculating numbers**:

```
+-----------------------+      +---------------------------------+      +------------------------------+
| User Advisory Prompt  |      |   Deterministic Math Engines    |      |    PII Sanitization Layer    |
| "Can I afford to buy  | ───► | Computes:                       | ───► | Scrubs: Name, Email, PAN,   |
|  a ₹1.5 Cr home?"     |      | • Net Worth: ₹1.25 Cr           |      | Folio, exact Bank Numbers.   |
+-----------------------+      | • Liquid Corpus: ₹35 Lakhs      |      | Replaces with generic tokens.|
                               | • Monthly Savings: ₹85,000      |      +--------------┬---------------+
                               | • DTI with new EMI: 48% (High!) |                     │
                               +---------------------------------+                     ▼
+------------------------------------------------------------------------------------------------------+
|                                    MINIMAX LLM ADVISORY GATEWAY                                      |
|  Prompt: "Given financial metrics: Net Worth ₹1.25 Cr, Liquid ₹35 L, DTI 48%. Analyze home purchase."|
|  Output: Formatted analytical explanation, trade-off analysis, and risk factors.                     |
+------------------------------------------------------------------------------------------------------+
```

### 14.2 Prompt Sanitization, PII Redaction & Inherent Limitations
- **Algorithmic Redaction:** The `PIIAnonymizer` service runs regex and dictionary-based scrubbing:
  - Email addresses $\to$ `[EMAIL_REDACTED]`
  - Indian PAN / Aadhaar numbers $\to$ `[TAX_ID_REDACTED]`
  - Account numbers (> 4 digits) $\to$ `••••${last4}`
  - Full names $\to$ `[USER]`
  - Broker names and Folios $\to$ `[FOLIO_REDACTED]`
- **Inherent Limitation Disclosure:** While direct identifiers are stripped, users must understand that indirect re-identification through unique financial profiles (e.g., specific asset amounts or rare holding combinations) remains theoretically possible if LLM logs are subpoenaed. Raw transactional histories are never passed to the LLM.

### 14.3 MiniMax LLM Integration & Structured Output Contracts
- **Provider:** MiniMax API (`https://api.minimax.chat/v1/text/chatcompletion_v2`).
- **Prompt Structure:** System prompt enforces the persona of an institutional chartered financial analyst (CFA), forbidding stock tips or speculative trading recommendations.
- **Validation:** Responses must conform to structured Markdown with clearly separated sections: *Executive Summary*, *Quantitative Reality Check*, *Actionable Recommendations*, and *Risk Warnings*.

---

## 15. Background Jobs, Cron Scheduling, and Notifications

### 15.1 Scheduled Worker Execution & Cron Topologies
Background jobs run as authenticated Next.js route handlers invoked via **Vercel Cron** or **Upstash QStash** using bearer token authentication (`CRON_SECRET`):

| Job Name | Schedule | Route Path | Responsibility |
|---|---|---|---|
| **Daily NAV Sync** | `0 22 * * 1-5` (22:00 UTC) | `/api/v1/cron/nav-sync` | Iterates through all unique mutual fund ISINs/schemes; fetches latest NAV from `mfapi.in`; updates `AssetPriceHistory`. |
| **Stock Quote Refresh** | `*/30 9-16 * * 1-5` (Market hours) | `/api/v1/cron/stock-sync` | Refreshes equity quotes for active NSE/BSE and US stocks via Yahoo Finance. |
| **Daily FX Sync** | `0 1 * * *` (01:00 UTC) | `/api/v1/cron/fx-sync` | Synchronizes USD/INR, EUR/INR, GBP/INR exchange rates into `FXRate` table. |
| **Historical Snapshot Job** | `0 0 * * *` (Midnight UTC) | `/api/v1/cron/snapshots` | Generates immutable daily `Snapshot` records for all active users, capturing total assets, liabilities, and net worth. |
| **Budget & EMI Monitor** | `0 8 * * *` (08:00 UTC) | `/api/v1/cron/budget-alerts` | Evaluates budget spending against 80%/100% thresholds and flags loans with due dates in the next 3 days. |

### 15.2 Alert Triggers, Budget Thresholds, and Push Notifications
- **Budget Threshold Alerts:** When categorized expenses exceed 80% or 100% of a defined monthly budget, an in-app alert banner is generated and an email dispatch is triggered.
- **Loan EMI Due Date Alerts:** Triggers reminders 3 calendar days before loan due dates.
- **Unusual Cash Outflow Alerts:** Flags single transactions exceeding 20% of the user's monthly income for review.



## 16. Security, Authorization, Tenant Isolation, and Privacy

### 16.1 Authentication Framework (Clerk Session & MFA Management)
- **Identity Provider:** Managed authentication provided via **Clerk**.
- **Supported Auth Protocols:** Email OTP (passwordless), Google OAuth, Apple Sign-In, and Time-based One-Time Password (TOTP) Multi-Factor Authentication (MFA).
- **Session Validation:** All requests to protected dashboard routes and `/api/v1/*` endpoints pass through Next.js edge middleware (`middleware.ts`), validating the short-lived Clerk session JWT.
- **CSRF & Cookie Protection:** Clerk session cookies utilize `SameSite=Lax`, `HttpOnly`, and `Secure` attributes over TLS 1.3.

### 16.2 Tenant Data Isolation & Service-Layer Authorization
- **Strict Query Scoping:** Every database read, mutation, and aggregation is explicitly filtered by `userId` extracted directly from the verified Clerk session token:
  ```typescript
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, userId: authenticatedUserId, deletedAt: null }
  });
  if (!asset) throw new NotFoundError("Asset not found");
  ```
- **Anti-Enumeration Defense:** Attempting to access an entity belonging to another user returns **HTTP 404 Not Found** (rather than HTTP 403 Forbidden). This prevents malicious actors from enumerating valid entity IDs across tenant accounts.
- **Profile Context Boundary:** In multi-profile environments, the user's active `profileId` must be verified as belonging to the authenticated `userId` before any profile-scoped operations are permitted.

### 16.3 Zero-Trust Ephemeral File Handling (RAM-Only Processing)
- **Zero Disk Persistence Guarantee:** File uploads (broker spreadsheets and CAS PDFs) are received as streaming buffers directly into Node.js volatile memory (`Uint8Array` / `Buffer`).
- **No Temporary Files:** Files are never written to the local server filesystem (`/tmp`, local scratch disks) or cloud object storage (AWS S3, Google Cloud Storage).
- **Immediate Memory Release:** As soon as file parsing and staging row creation completes, buffer references are nullified, and Node.js garbage collection cleans the allocated memory.
- **Ephemeral Password Lifetime:** User-entered PDF passwords are used solely in memory during decryption and are immediately discarded. Passwords are never persisted, cached, or included in server logs.

### 16.4 Secrets Management, Rate Limiting, Error Redaction & Audit Logging
- **Secrets Management:** Environment variables containing sensitive credentials (`DATABASE_URL`, `CLERK_SECRET_KEY`, `MINIMAX_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`) are injected via Vercel Secrets and never committed to version control.
- **API Rate Limiting:** Enforced via Upstash Redis token bucket algorithm:
  - Financial CRUD APIs: 120 requests/minute per authenticated user.
  - File Import & Decryption APIs: 5 uploads/minute per user.
  - AI Advisory Chat: 10 queries/minute per user.
- **Error Redaction:** Production error handlers strip SQL queries, stack traces, and internal server paths before sending error payloads to clients. Generic error messages with correlation IDs are returned.
- **Audit Logging:** Sensitive actions (account deletion, portfolio wipe, password toggle) record immutable audit entries in structured JSON logs.

### 16.5 Data Export, Soft Deletion, and Hard Purge Guarantees
- **GDPR / DPDP Compliance:** Users retain absolute ownership of their financial records.
- **Full Data Export:** `GET /api/v1/settings/data/export` produces a complete, unencrypted ZIP archive containing:
  - `assets.csv` & `transactions.csv`
  - `liabilities_amortization.json`
  - `full_backup.json` (complete relational dump matching target schema).
- **Soft Deletion vs. Hard Purge:**
  - Day-to-day deletion utilizes soft delete (`deletedAt = now()`) to preserve historical net worth snapshot integrity.
  - Hard Purge: Initiating account deletion permanently and cascade-deletes all database rows across all tables within 30 days.

---

## 17. Calculation Rules, Financial Precision, and Consistency

### 17.1 Mathematical Models & Algorithmic Implementation

#### 1. Net Worth Calculation
$$\text{Net Worth} = \sum_{i=1}^{A} \left( \text{Asset Quantity}_{i} \times \text{Unit Price}_{i} \times \text{FX}_{i} \right) - \sum_{j=1}^{L} \left( \text{Outstanding Principal}_{j} \times \text{FX}_{j} \right)$$

#### 2. Compound Annual Growth Rate (CAGR)
$$\text{CAGR} = \left( \frac{V_{\text{final}}}{V_{\text{initial}}} \right)^{\frac{1}{n}} - 1$$
*Where $n$ represents the holding period in fractional years.*

#### 3. Loan Equated Monthly Installment (EMI) Formula
$$\text{EMI} = P \times r \times \frac{(1 + r)^n}{(1 + r)^n - 1}$$
*Where:*
- $P$ = Principal Loan Amount
- $r$ = Monthly interest rate (Annual Rate / 12 / 100)
- $n$ = Loan tenure in total months

### 17.2 XIRR Calculation & Numerical Convergence Bounds
The Extended Internal Rate of Return (XIRR) is computed by solving for the discount rate $r$ such that the Net Present Value (NPV) of all irregular cashflows equals zero:

$$\text{NPV}(r) = \sum_{k=0}^{N-1} \frac{C_k}{(1 + r)^{\frac{d_k - d_0}{365}}} = 0$$

- **Numerical Algorithm:** FinanceAI uses the **Newton-Raphson Method**:
  $$r_{i+1} = r_i - \frac{\text{NPV}(r_i)}{\text{NPV}'(r_i)}$$
- **Convergence Bounds & Safety Guards:**
  - Maximum Iterations: **100 iterations**.
  - Convergence Tolerance: $|\text{NPV}(r)| < 10^{-6}$.
  - Derivative Guard: If $|\text{NPV}'(r_i)| < 10^{-9}$ (slope near zero), switch immediately to **Bisection Method** between bounds $[-0.99, +5.00]$.
  - Negative Return Support: Handles negative XIRR down to $-99.0\%$.
  - Divergence Fallback: If no convergence is achieved after 100 iterations, return `null` and display simple Absolute Return ($Total Gain / Total Invested$) to the user.

### 17.3 Loan EMI & Amortization Formulas with Zero-Division Guards
- **Zero-Interest Loan Guard ($r = 0$):** In 0% interest promotional loans, the standard EMI formula results in division by zero ($0/0$). The engine implements an explicit conditional guard:
  $$\text{If } r = 0 \implies \text{EMI} = \frac{P}{n}$$
- **Monthly Interest and Principal Breakdown:**
  $$\text{Interest Paid}_m = \text{Remaining Balance}_{m-1} \times r$$
  $$\text{Principal Paid}_m = \text{EMI} - \text{Interest Paid}_m$$
  $$\text{Remaining Balance}_m = \text{Remaining Balance}_{m-1} - \text{Principal Paid}_m$$
- **Precision Rounding Rule:** All intermediate calculations are executed using high-precision Decimal arithmetic, with currency amounts rounded to 2 decimal places using half-up banker's rounding (`ROUND_HALF_UP`).

### 17.4 Immediate Event-Driven Net Worth Recalculation Engine
- **Event-Driven Recalculation:** Every transaction creation, asset quantity update, or debt modification triggers the synchronous recalculation of the user's active net worth.
- **Calculated State Invalidation:** Triggers automatic invalidation of the user's Redis net worth cache key (`cache:networth:${userId}`), ensuring subsequent API requests return fresh totals.

---

## 18. Caching, Resilience, Observability, and Performance

### 18.1 Multi-Tier Caching Architecture (Redis / Upstash + In-Memory Fallback)
FinanceAI deploys a multi-tier cache-aside pattern to respect third-party rate limits and achieve sub-50ms dashboard response times:

```
[ Client / Browser Layer ]
  └─► TanStack Query: 30-second staleTime; SWR (Stale-While-Revalidate)
          │
          ▼
[ Server Layer: Redis Cache (Upstash) ]
  • Market Quotes: TTL = 15 Minutes (Key: "quote:{ticker}")
  • NAV Data: TTL = 24 Hours (Key: "nav:{schemeCode}")
  • FX Rates: TTL = 24 Hours (Key: "fx:{from}:{to}")
  • User Net Worth Rollup: TTL = 5 Minutes (Key: "rollup:{userId}:{profileId}")
          │
          ▼ (On Redis Unreachable / Network Timeout)
[ Local Memory Cache (LRU Map Fallback) ]
  • Node.js process LRU Cache (max 10,000 entries) prevents API crashes during Redis outages.
```

### 18.2 Resilience, Circuit Breakers, and Exponential Backoff
- **Exponential Backoff:** Outbound requests to external APIs (`mfapi.in`, Yahoo Finance, MiniMax) execute with exponential backoff:
  - Attempt 1: Immediate.
  - Attempt 2: After 500ms + random jitter.
  - Attempt 3: After 1500ms + random jitter.
- **Circuit Breaker Pattern:** If an external provider returns 5 consecutive HTTP 5xx errors or timeouts within a 60-second window, the circuit breaker opens for 180 seconds. While open, requests immediately return cached or fallback statement data without making network calls.

### 18.3 Observability, Sentry Error Tracking, and Performance Budgets
- **Error Monitoring:** **Sentry** captures all unhandled frontend React errors and backend API exceptions, scrubbing all financial values and PII before transmission.
- **Structured JSON Logging:** Server logs are output as structured JSON objects containing `timestamp`, `level`, `userId`, `route`, `durationMs`, and `statusCode`.
- **Performance Budgets:**
  - Net Worth API (`GET /api/v1/networth`): Response time $< 150\text{ms}$ at 95th percentile.
  - File Upload & Staging Preview: Processing time $< 2.5\text{s}$ for statements up to 500 rows.
  - Lighthouse Performance Score: Target $\ge 90$ on desktop and mobile.

---

## 19. Testing Strategy, Acceptance Criteria, and Reference Test Cases

### 19.1 Multi-Layer Testing Pyramid
1. **Unit Tests (Vitest):** Tests pure mathematical calculations (XIRR, EMI, Health Score, Deduplication Hash) in isolation with 100% code coverage.
2. **Integration Tests (Vitest + Test Containers / Isolated DB):** Tests Prisma repository queries, paired transfer transactions, statement staging workflows, and tenant isolation.
3. **End-to-End Tests (Playwright):** Validates complete browser flows: User Sign-in $\to$ Add Holding $\to$ Upload Statement $\to$ Reconcile Preview $\to$ Verify Dashboard Rollup.

### 19.2 Concrete Reference Acceptance Test Cases

#### Reference Case 1: Annualized XIRR Convergence
- **Scenario:** Investor makes a lump-sum investment of ₹1,00,000 on January 1, 2025. Exactly one year later on January 1, 2026, the portfolio value is ₹1,15,000.
- **Input Cash Flows:**
  - `{ date: "2025-01-01", amount: -100000.00 }`
  - `{ date: "2026-01-01", amount: +115000.00 }`
- **Expected Result:** XIRR converges to exactly **15.00%** (0.150000) within 4 iterations with tolerance $< 10^{-6}$.

#### Reference Case 2: Loan EMI and Amortization Schedule
- **Scenario:** User enters a Home Loan of ₹50,00,000 at 8.50% annual interest rate for a tenure of 20 years (240 months).
- **Inputs:** Principal $P = 50,00,000.00$, Annual Rate $R = 8.50\%$, Tenure $n = 240$.
- **Expected Results:**
  - Monthly EMI: **₹43,391.17**
  - Month 1 Breakdown: Principal Paid = **₹7,974.50**, Interest Paid = **₹35,416.67**, Remaining Balance = **₹49,92,025.50**.
  - Total Interest Over Tenure: **₹54,13,880.80**.
  - Total Repayment: **₹1,04,13,880.80**.

#### Reference Case 3: Double-Entry Paired Account Transfer
- **Scenario:** User transfers ₹50,000 from Savings Account (initial balance ₹1,50,000) to Demat Account (initial balance ₹20,000).
- **Execution:** `POST /api/v1/transactions/transfer` within a Prisma atomic transaction.
- **Expected Results:**
  - Generates two transactions linked by identical `transferGroupId`.
  - Savings Account balance decreases to exactly **₹1,00,000.00**.
  - Demat Account balance increases to exactly **₹70,000.00**.
  - User's Net Worth remains completely unchanged (Net Delta = **₹0.00**).

#### Reference Case 4: Immediate Net Worth Rollup vs Market Polling
- **Scenario:** User has 100 shares of TCS with current price ₹3,500 (Total Asset Value ₹3,50,000). User adds 10 new shares of TCS at ₹3,500.
- **Expected Result:** Portfolio total immediately updates to **₹3,85,000.00** synchronously without waiting for market price cron jobs.

#### Reference Case 5: Triangular Multi-Currency FX Conversion
- **Scenario:** User holds €1,000 in European equities. System has exchange rates: `EUR/USD = 1.0850` and `USD/INR = 83.50`.
- **Expected Result:** Engine calculates EUR to INR rate as $1.0850 \times 83.50 = 90.5975$. Total holding value in INR is exactly **₹90,597.50**.

#### Reference Case 6: Statement Re-import Idempotency & Conflict Detection
- **Scenario:** User imports Groww mutual fund export containing 5 holdings. Later, user re-imports the exact same file.
- **Expected Results:**
  - Staging detects 0 `NEW_HOLDING` conflicts.
  - Identifies 5 `IDENTICAL` rows.
  - Zero duplicate rows written to database.
  - Existing market prices and price history remain untouched.

#### Reference Case 7: Strict Tenant Isolation Defense
- **Scenario:** Malicious User B attempts to fetch an asset belonging to User A via `GET /api/v1/assets/ast_userA_12345`.
- **Expected Result:** API returns **HTTP 404 Not Found** (not HTTP 403), completely masking the existence of the entity.

#### Reference Case 8: Historical Snapshot Consistency
- **Scenario:** Daily snapshot job runs at midnight UTC. User has Assets = ₹20,00,000, Liabilities = ₹5,00,000.
- **Expected Result:** Creates immutable `Snapshot` row with `totalAssets = 2000000.00`, `totalLiabilities = 500000.00`, `netWorth = 1500000.00`. Subsequent edits to assets do not retroactively alter this snapshot.

---

## 20. Deployment Architecture and Environment Configuration

### 20.1 Target Production Deployment Topology
- **Application Host:** **Vercel** deploying Next.js 14 App Router as Edge Middleware and Serverless Functions across multiple regions.
- **Database Server:** **Supabase / Neon** Serverless PostgreSQL with built-in connection pooling (`pgBouncer`).
- **Distributed Cache & Rate Limiting:** **Upstash Redis** (Serverless REST-based Redis).
- **Authentication Service:** **Clerk Managed Auth** (handling session tokens, OAuth, MFA).
- **Scheduled Cron Runner:** **Vercel Cron** invoking secured internal API endpoints.

### 20.2 Complete Environment Variables Reference (`.env.example`)

| Environment Variable | Required / Optional | Purpose | Default / Example Value | Production Security Notes |
|---|---|---|---|---|
| `NODE_ENV` | Required | Application runtime environment | `production` | Must be `production` in live deployments. |
| `NEXT_PUBLIC_APP_URL` | Required | Base application URL for redirects and CORS | `https://app.financeai.com` | Enforce HTTPS. |
| `DATABASE_URL` | Required | PostgreSQL connection string with pooling | `postgresql://user:pass@pool.supabase.com:6543/db?pgbouncer=true` | Must use SSL and connection pooler. |
| `DIRECT_URL` | Required | Direct PostgreSQL connection for Prisma migrations | `postgresql://user:pass@db.supabase.com:5432/db` | Used solely for running Prisma migrations. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required | Clerk public frontend API key | `pk_live_...` | Safe for client-side inclusion. |
| `CLERK_SECRET_KEY` | Required | Clerk backend secret API key | `sk_live_...` | Never expose to client; rotates if compromised. |
| `CLERK_SIGN_IN_URL` | Required | Sign-in page route | `/sign-in` | Default route for unauthenticated redirects. |
| `CLERK_SIGN_UP_URL` | Required | Sign-up page route | `/sign-up` | Route for new user registration. |
| `UPSTASH_REDIS_REST_URL` | Required | Upstash Redis REST endpoint | `https://us1-clean-slug.upstash.io` | HTTPS REST endpoint for serverless caching. |
| `UPSTASH_REDIS_REST_TOKEN` | Required | Upstash Redis authentication token | `AX12AS...` | Keep secret; rotates via Upstash console. |
| `MINIMAX_API_KEY` | Required | MiniMax LLM API bearer token | `ey...` | Serverless backend only; never exposed to browser. |
| `MINIMAX_GROUP_ID` | Optional | MiniMax organization / group ID | `1892837492` | Required for certain MiniMax API endpoints. |
| `CRON_SECRET` | Required | Shared secret header validating cron requests | `super-secret-cron-token-32-chars` | Verified in `Authorization: Bearer <CRON_SECRET>`. |
| `SENTRY_DSN` | Optional | Sentry error tracking endpoint | `https://public@sentry.io/123456` | Used for production error capture. |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | Optional | Default fallback currency | `INR` | Overridden by user profile preferences. |



## 21. Measurable Phased Implementation Roadmap

### 21.1 Phase Dependencies, Deliverables, Regression Tests, Recovery, and Gates

To ensure systematic execution, no feature is considered complete merely because a UI mock, schema model, or endpoint skeleton exists. Every phase has strict dependencies, measurable deliverables, regression tests, recovery strategies, and objective completion gates.

```
[ Phase 1: Core Foundation & Decimal Migration ] (Weeks 1-4)
                      │
                      ▼
[ Phase 2: Broker Import Pipeline & Staging ] (Weeks 5-8)
                      │
                      ▼
[ Phase 3: Market Price Engine & Analytics Suite ] (Weeks 9-12)
                      │
                      ▼
[ Phase 4: Debt Engine & Amortization Suite ] (Weeks 13-16)
                      │
                      ▼
[ Phase 5: Privacy-Preserving AI & Health Score ] (Weeks 17-20)
```

---

#### Phase 1: Core Foundation, Ledger Hardening & Decimal Migration (Weeks 1–4)
- **Dependencies:** Active PostgreSQL database, Clerk Auth project credentials.
- **Deliverables:**
  1. Production target Prisma schema deployment with `Profile` and `Account` models.
  2. SQL migration script casting all `Float` balances to `DECIMAL(19, 4)` and quantities to `DECIMAL(18, 6)`.
  3. Paired transaction transfer logic with atomic double-entry execution and `transferGroupId`.
  4. Scoped deduplication constraint `@@unique([userId, accountId, importKey])`.
  5. Multi-profile switcher UI in dashboard header.
- **Regression Tests:**
  - Verify existing user records retain exact historical balances post-decimal casting.
  - Test paired transfer atomicity: simulated failure on credit leg rolls back debit leg completely.
  - Test cross-account identical asset creation without unique constraint collision.
- **Migration & Recovery Strategy:**
  - Pre-migration `pg_dump` backup.
  - If migration fails, revert to previous schema via rollback SQL script; re-verify service health.
- **Objective Completion Gate:**
  - `vitest run` executes with 100% pass rate across core models.
  - Zero `Float` types remaining in financial monetary columns.
  - Paired transfers verified with balanced ledger invariants (Net Worth delta = 0).

---

#### Phase 2: Broker Import Pipeline & Staging Hardening (Weeks 5–8)
- **Dependencies:** Completion of Phase 1 (`Account` model and scoped deduplication).
- **Deliverables:**
  1. Persistent database staging tables: `ImportBatch` and `ImportStagingRow`.
  2. Integration of ephemeral CAS PDF parser using `pdfjs-dist` with in-memory password decryption.
  3. Two-phase preview UI displaying New, Updated, and Missing holdings with row-level checkboxes.
  4. Explicit rejection handler and error messaging for unsupported broker formats (e.g., INDmoney Indian stocks).
- **Regression Tests:**
  - Execute `tests/adapters.test.ts` across Groww Stock, Groww MF, INDmoney US Stock, and INDmoney MF suites.
  - Verify that re-importing the same statement yields 0 duplicates and leaves existing prices intact.
  - Verify that corrupted files return descriptive errors with zero database writes.
- **Migration & Recovery Strategy:**
  - Staging tables are isolated; batch errors do not pollute live `Asset` table.
  - Provide a one-click *"Rollback Import Batch"* feature using `ImportBatch.status = 'ROLLED_BACK'`.
- **Objective Completion Gate:**
  - Automated test verifying that uploaded files are never written to disk or `/tmp`.
  - User can upload Groww, INDmoney, and CAS statements and successfully review the staging preview before committing.

---

#### Phase 3: Market Price Engine & Analytics Suite (Weeks 9–12)
- **Dependencies:** Completion of Phase 2 (Holdings populated with ISIN and tickers).
- **Deliverables:**
  1. Distributed caching layer via **Upstash Redis** replacing in-memory Map.
  2. Daily NAV refresh worker calling `mfapi.in` with rate-limit throttling.
  3. Yahoo Finance quote fetcher with 15-minute caching and circuit-breaker fallbacks.
  4. Multi-currency FX pipeline storing daily rates in `FXRate` with triangular conversion.
  5. Deterministic XIRR calculation engine with Newton-Raphson and bisection fallback.
- **Regression Tests:**
  - Test XIRR convergence on reference cash flows matching institutional test fixtures.
  - Test third-party API outage resilience: with network cut off, portfolio valuation falls back to statement prices.
  - Test Redis cache hit latency ($< 5\text{ms}$).
- **Migration & Recovery Strategy:**
  - In-memory LRU cache maintained as automatic failover if Redis connection times out.
- **Objective Completion Gate:**
  - XIRR algorithm passes unit test suite with 100% convergence across standard test vectors.
  - Scheduled cron jobs execute without unhandled promise rejections.

---

#### Phase 4: Debt Engine & Amortization Suite (Weeks 13–16)
- **Dependencies:** Completion of Phase 1 (Decimal precision and liability ledger).
- **Deliverables:**
  1. `LoanAmortizationSchedule` generator supporting fixed and floating interest rates.
  2. Interactive Prepayment Simulator showing interest saved and tenure reduction.
  3. Debt Payoff Optimizer comparing Debt Snowball vs. Debt Avalanche strategies.
  4. Interactive Financial Calculators Suite (SIP, Lumpsum, Step-up, EMI, FIRE).
- **Regression Tests:**
  - Verify institutional EMI test fixture: ₹50L @ 8.5% for 20y yields ₹43,391.17 EMI.
  - Verify zero-interest loan edge case ($r = 0$).
  - Verify prepayment calculation: lump-sum prepayment of ₹5L reduces remaining tenure accurately.
- **Migration & Recovery Strategy:**
  - Schedules can be regenerated on demand from liability parameters; data loss is non-fatal.
- **Objective Completion Gate:**
  - All 8 financial calculators verified against standard financial benchmark tables.
  - Amortization table generates in $< 50\text{ms}$ client-side.

---

#### Phase 5: Privacy-Preserving AI Advisory & Health Score (Weeks 17–20)
- **Dependencies:** Completion of Phases 1 through 4 (All financial metrics computed deterministically).
- **Deliverables:**
  1. Pure deterministic 4-pillar Financial Health Score engine (0–100).
  2. PII Sanitization pipeline scrubbing names, emails, and account numbers.
  3. MiniMax LLM integration with structured JSON response contracts.
  4. Prominent educational disclaimers and privacy mode integration across all screens.
- **Regression Tests:**
  - Verify that zero PII tokens are passed in outgoing LLM network payloads.
  - Test Health Score boundary cases (0 emergency fund, 60% DTI, 0 savings rate yields expected low score).
  - Verify AI conversation JSON parsing error handling.
- **Migration & Recovery Strategy:**
  - LLM outages degrade gracefully to standard deterministic metrics dashboards.
- **Objective Completion Gate:**
  - End-to-end security audit confirms zero raw financial credentials or PII transmitted to external AI endpoints.
  - Health score produces consistent, deterministic results with zero random variance.

---

## 22. Known Limitations, Assumptions, and Open Decisions

### 22.1 Technical Limitations & Architectural Assumptions
1. **No Open-Banking Direct Sync:** FinanceAI intentionally does not implement automated bank credential scraping. All cash accounts and bank balances rely on statement imports or manual updates, prioritizing user privacy over passive automation.
2. **Third-Party API Quotas:** Public market data feeds (`mfapi.in` and Yahoo Finance free endpoints) are subject to rate limits. Strict caching (15-min quote TTL, 24-hr NAV TTL) is mandatory to prevent IP blocks.
3. **Primary Regional Baseline:** The system assumes **INR** as the primary default currency with Indian numbering standards (`en-IN`), while supporting USD and EUR secondary multi-currency conversions.
4. **Browser-Level Cryptography Limits:** Client-side PDF decryption in older mobile browsers can be memory-intensive. Serverless in-memory RAM processing is utilized as the primary engine.

### 22.2 Open Architectural Decisions & Research Questions
- **Decided: Broker Import Scope:** Groww (Stocks/MF) and INDmoney (US Stocks/MF) are verified in code. CAMS/KFintech CAS PDF is the designated target for comprehensive mutual fund coverage. INDmoney Indian stocks and derivative contracts are deferred to post-Phase 4.
- **Decided: Database Deduplication:** Deduplication uniqueness is scoped to `userId + accountId + importKey`, resolving cross-account collisions.
- **Open Decision 1: CAS PDF Password UX:** Standardizing automatic password attempts (trying PAN uppercase, lowercase, and PAN+DOB) vs. prompting the user explicitly on upload. Recommendation: Prompt user with informative helper tooltip explaining common CAMS/KFintech password conventions.
- **Open Decision 2: Self-Hosted Docker Deployment:** While Vercel + Supabase is the primary production target, privacy-focused HNIs frequently request a self-hosted single-container Docker deployment. Architecture is decoupled to allow packaging via Docker Compose in future milestones.

---

## 23. Definition of Done

A feature, module, or user story is considered **DONE** and eligible for production release only when meeting all of the following objective criteria:
1. **Strict TypeScript & Zero `any`:** Written in strict TypeScript 5.x with 0 ESLint warnings and zero `any` types.
2. **Database Integrity:** Database migrations executed with Prisma, fully backward-compatible with backfill verification.
3. **High-Precision Financial Math:** All monetary figures use `Decimal(19, 4)`. Unit tests verify mathematical invariants (e.g., paired transfers balance to zero, amortization schedules sum to total repayment).
4. **Automated Test Coverage:**
   - Financial engines (XIRR, EMI, Health Score) covered with $\ge 95\%$ unit test coverage.
   - API endpoints covered with integration tests verifying tenant isolation (HTTP 404 on cross-user queries).
5. **Zero-Trust Security & Privacy:**
   - Ephemeral file handling verified (zero file persistence to disk or object storage).
   - PII masking verified on all outbound AI payloads.
   - All protected routes verified against unauthenticated access.
6. **Observability & Error Handling:** Structured JSON logging implemented; all user-facing errors gracefully redacted.
7. **Production Documentation:** API contracts and user documentation updated in repository.

---

## 24. Final Architecture Reconciliation Report

### 24.1 Restored Substantive Requirements from v2.0
The following critical technical specifications from Version 2.0 that were condensed or omitted in intermediate drafts have been fully restored with complete engineering depth:
1. **Frontend Architecture & Design Standards:** Restored Section 8 detailing Next.js 14 App Router, RSC, Zustand UI stores, Recharts data visualization, and the comprehensive `en-IN` vs. `en-US` currency formatting standards.
2. **Modular Backend Service Architecture:** Restored Section 9 detailing single-responsibility service ownership, interface boundaries, and explicit service file mappings.
3. **Complete Production Prisma Schema:** Restored Section 10 with the full, production-ready target Prisma schema including `Profile`, `Account`, `ImportBatch`, `ImportStagingRow`, `LoanAmortizationSchedule`, `AssetPriceHistory`, and `FXRate`.
4. **Exhaustive REST API Specifications:** Restored Section 11 with end-to-end request payloads, response envelopes, and query parameter contracts.
5. **Multi-Stage Import Pipeline:** Restored Section 12 detailing the 6-stage lifecycle, CAS PDF regex rules, and ephemeral RAM buffer security.
6. **Numerical Convergence Models:** Restored Section 17 detailing Newton-Raphson iteration bounds (100 cap, $10^{-6}$ tolerance), bisection fallbacks, and zero-division guards.
7. **Multi-Tier Caching & Observability:** Restored Section 18 detailing Redis cache-aside TTLs, circuit breakers, Sentry integration, and performance budgets.
8. **Complete Deployment & Environment Variables:** Restored Section 20 with the complete `.env.example` reference table.

### 24.2 Valid Corrections Retained from v2.1 and v2.2
All valid corrections and reality-checks from Version 2.1 and Version 2.2 have been rigorously preserved:
1. **Current Codebase Reality Check:** Accurately reflected that CAMS CAS PDF, persistent DB staging, and full loan amortization math are target architecture (not yet implemented in current code), while honoring existing working Groww and INDmoney adapters.
2. **Deduplication Scoping Bugfix:** Retained the critical fix replacing `unique([userId, importKey])` with `unique([userId, accountId, importKey])`.
3. **Market Pricing vs Recalculation Separation:** Clarified that market prices follow a 15-minute polling/caching model, while net worth aggregations recalculate immediately and synchronously upon transaction changes.
4. **Double-Entry Paired Transfer Linking:** Maintained paired transfer grouping via `transferGroupId`.
5. **Decimal Precision Migration Plan:** Retained the phased migration from IEEE 754 `Float` to `Decimal(19, 4)`.

### 24.3 Explicitly Identified Remaining Unverified Claims
In compliance with Non-Negotiable Rule 5, the following claims from external benchmark sources or high-level requirements are explicitly marked as **unverified** against the current codebase:
1. **INDmoney Indian Stocks Export:** Lacks working adapter in code; explicitly throws unsupported format error.
2. **Groww F&O and Commodity Exports:** No adapter or test fixtures exist in the repository.
3. **Direct Open-Banking Account Aggregator (AA) Integration:** Mentioned in benchmark research but absent from current implementation; confirmed as out-of-scope.
4. **Third-Party Broker Trade APIs:** No direct brokerage integration exists; marked as out-of-scope.

### 24.4 Unresolved Architectural Decisions
1. **CAS PDF Password Strategy:** Resolving automatic brute-force attempts across common PAN/DOB patterns vs. explicit user password input prompt.
2. **Self-Hosted Docker Deployment Support:** Prioritization of an official Docker Compose bundle for privacy-centric HNI users.

### 24.5 Section-by-Section Completeness Checklist

| Section # | Section Title | Completeness Status | Notes |
|---|---|---|---|
| **1** | Executive Summary and Product Scope | Complete | Full vision, value proposition, personas, scope matrix |
| **2** | Architecture Principles and Scope Boundaries | Complete | Zero-trust RAM handling, in-scope vs non-goals |
| **3** | Verified Current State Audit vs Benchmark | Complete | Code verification against audit.md & broker audit |
| **4** | Comprehensive Feature Register | Complete | Master table with origins, status, tests, and criteria |
| **5** | Functional Modules & Feature Specifications | Complete | 5.1 through 5.10 fully specified |
| **6** | Application Navigation & Page Architecture | Complete | Complete Next.js 14 sitemap & layout standards |
| **7** | High-Level System Architecture & Topology | Complete | Topology diagram & data flow architecture |
| **8** | Frontend Architecture & Design System | Complete | RSC, Zustand, Recharts, en-IN formatting |
| **9** | Backend and Service Architecture | Complete | Controller layer & service ownership matrix |
| **10** | Target Domain Model & Prisma Schema | Complete | Production target schema & migration steps |
| **11** | API Route & Service Contract Reference | Complete | Full request/response contracts for all core APIs |
| **12** | Import Pipeline & Broker Format Engine | Complete | 6-stage pipeline, CAS rules, Groww/INDmoney rules |
| **13** | Market Price Engine, NAV & FX Pipeline | Complete | Polling vs real-time, fallbacks, FX conversion |
| **14** | AI Advisory & Deterministic Engines | Complete | Decoupled AI, PII scrubbing, MiniMax contracts |
| **15** | Background Jobs & Notifications | Complete | Cron schedules, alert triggers, budget monitors |
| **16** | Security, Authorization & Tenant Isolation | Complete | Clerk auth, RAM-only file handling, anti-enumeration |
| **17** | Calculation Rules & Precision | Complete | Mathematical formulas, XIRR bounds, EMI math |
| **18** | Caching, Resilience & Observability | Complete | Multi-tier cache, circuit breakers, Sentry, budgets |
| **19** | Testing Strategy & Reference Test Cases | Complete | Testing pyramid, 8 concrete reference test cases |
| **20** | Deployment & Environment Configuration | Complete | Vercel/Supabase topology, complete .env table |
| **21** | Measurable Phased Implementation Roadmap | Complete | Phases 1–5 with deliverables, tests, gates |
| **22** | Known Limitations, Assumptions & Decisions | Complete | Technical boundaries & open architectural questions |
| **23** | Definition of Done | Complete | Objective measurable release gates |
| **24** | Final Architecture Reconciliation Report | Complete | Full reconciliation & compliance verification |

### 24.6 Confirmation of Zero Application Code Modifications
In strict compliance with Non-Negotiable Rule 4, **zero application code, database files, dependencies, migrations, or environment files have been modified** during the production of this architecture reconciliation. The repository code, tests, and configuration remain 100% unaltered.

---
*End of FinanceAI Architecture Specification v2.3*
