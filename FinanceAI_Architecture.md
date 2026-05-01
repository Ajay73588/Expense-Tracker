**ARCHITECTURE DOCUMENT**

**AI-Powered Personal Finance &**

**Investment Advisory System**

*Production-Grade System Design*

Full-Stack Fintech Web Application

  ----------------------------------- ------------------------------------------------
  **Stack**                           Next.js · Node.js · PostgreSQL · Prisma

  **AI Layer**                        Minimax API · Prompt Builder · Advisory Engine

  **Auth**                            Clerk · JWT · Role-Based Access

  **Version**                         v1.0 --- Production Architecture
  ----------------------------------- ------------------------------------------------

**1. Executive Summary**

The AI-Powered Personal Finance & Investment Advisory System is a production-grade, full-stack fintech web application designed to serve as a complete financial decision-support platform. It goes far beyond transaction tracking --- it is an intelligent financial companion that aggregates multi-asset portfolios, analyzes financial health in real time, and delivers AI-driven advisory through a structured prompt engine backed by the Minimax API.

**1.1 Product Vision**

The platform unifies all aspects of a user\'s financial life --- income, spending, investments across asset classes (stocks, mutual funds, crypto, real estate, cash), debt, and future goals --- into a single, coherent interface backed by real-time market data and actionable AI insights.

**1.2 Core Design Principles**

-   Separation of Concerns: Clear boundaries between UI, API, Services, and Data layers

-   Extensibility: Every engine (price, insights, import) is plug-in ready for new providers

-   Security First: All financial data is isolated per user with auth enforcement at every layer

-   Observability by Default: Structured logging, error boundaries, and health metrics built in

-   AI-Augmented, Not AI-Dependent: Rule-based fallback ensures the system works without AI calls

**1.3 Key Metrics & Scale Targets**

  -----------------------------------------------------------------------
  **Metric**                          **Target**
  ----------------------------------- -----------------------------------
  Concurrent Users                    10,000+

  API Response Time (p95)             \< 300ms

  AI Advisory Latency                 \< 5s

  Portfolio Refresh Frequency         Every 15 minutes (market hours)

  Data Retention                      Full history, snapshotted daily

  Uptime SLA                          99.9%
  -----------------------------------------------------------------------

**2. High-Level Architecture**

**2.1 System Layers**

The system follows a strict layered architecture with no cross-layer bypasses. Each layer has a single, well-defined responsibility.

+---------------------------------------------------------------------------+
| ┌──────────────────────────────────────────────────────────────────────┐  |
|                                                                           |
| │ PRESENTATION LAYER │                                                    |
|                                                                           |
| │ Next.js 14 App Router │ Tailwind CSS │ Recharts │ Clerk UI │            |
|                                                                           |
| │ Dashboard │ Portfolio │ Goals │ AI Chat │ Import │ Settings │           |
|                                                                           |
| └───────────────────────────────┬──────────────────────────────────────┘  |
|                                                                           |
| │ HTTPS / REST                                                            |
|                                                                           |
| ┌───────────────────────────────▼──────────────────────────────────────┐  |
|                                                                           |
| │ API GATEWAY LAYER │                                                     |
|                                                                           |
| │ Next.js API Routes │ Clerk Auth Middleware │ Rate Limiter │             |
|                                                                           |
| │ Input Validation │ Error Normalizer │ Request Logger │                  |
|                                                                           |
| └───────────────────────────────┬──────────────────────────────────────┘  |
|                                                                           |
| │ Internal function calls                                                 |
|                                                                           |
| ┌───────────────────────────────▼──────────────────────────────────────┐  |
|                                                                           |
| │ SERVICE LAYER │                                                         |
|                                                                           |
| │ PortfolioService │ TransactionService │ BudgetService │                 |
|                                                                           |
| │ NetWorthService │ GoalsService │ HealthScoreService │                   |
|                                                                           |
| │ ImportService │ InsightsService │ AIAdvisoryService │                   |
|                                                                           |
| │ PriceEngineService │ AlertsService │                                    |
|                                                                           |
| └──────┬────────────────────────────────┬───────────────────────────────┘ |
|                                                                           |
| │ Prisma ORM │ External API Clients                                       |
|                                                                           |
| ┌──────▼──────────┐ ┌──────────▼──────────────────────────────┐           |
|                                                                           |
| │ PostgreSQL DB │ │ EXTERNAL INTEGRATIONS │                               |
|                                                                           |
| │ (Primary Store)│ │ Minimax AI API │ NSE/BSE Market APIs │               |
|                                                                           |
| │ │ │ MF API (India) │ CoinGecko Crypto │                                 |
|                                                                           |
| │ Redis Cache │ │ Groww CSV │ Zerodha KITE │                              |
|                                                                           |
| │ (In-memory) │ │ INDmoney CSV │ Binance / CoinDCX │                      |
|                                                                           |
| └─────────────────┘ └─────────────────────────────────────────┘           |
|                                                                           |
| ┌──────────────────────────────────────────────────────────────────────┐  |
|                                                                           |
| │ BACKGROUND JOB LAYER │                                                  |
|                                                                           |
| │ Price Updater (cron) │ Snapshot Engine │ Alert Dispatcher │             |
|                                                                           |
| │ AI Monthly Summary │ Portfolio Rebalance Checker │                      |
|                                                                           |
| └──────────────────────────────────────────────────────────────────────┘  |
+---------------------------------------------------------------------------+

**2.2 Request Lifecycle**

Every user request flows through a consistent pipeline before touching the database or external services:

-   Browser sends HTTPS request with Clerk JWT in Authorization header

-   Next.js middleware validates the token and attaches user context

-   API route handler validates request shape (Zod schema)

-   Service layer executes business logic, reads/writes via Prisma

-   Cache layer (Redis) is checked before expensive DB queries or external API calls

-   Response is normalized and returned; errors are caught and mapped to structured error codes

**3. Production Folder Structure**

The project uses a monorepo layout under Next.js with strict separation between frontend pages, API routes, server-side services, and shared utilities.

+-----------------------------------------------------------------------+
| financeai/                                                            |
|                                                                       |
| ├── app/ \# Next.js App Router                                        |
|                                                                       |
| │ ├── (auth)/ \# Auth routes (login, register)                        |
|                                                                       |
| │ ├── (dashboard)/ \# Protected dashboard routes                      |
|                                                                       |
| │ │ ├── dashboard/page.tsx \# Main financial overview                 |
|                                                                       |
| │ │ ├── portfolio/page.tsx \# Asset & portfolio view                  |
|                                                                       |
| │ │ ├── transactions/page.tsx \# Income / expense log                 |
|                                                                       |
| │ │ ├── budget/page.tsx \# Budget manager                             |
|                                                                       |
| │ │ ├── goals/page.tsx \# Financial goals tracker                     |
|                                                                       |
| │ │ ├── import/page.tsx \# CSV import wizard                          |
|                                                                       |
| │ │ ├── ai/page.tsx \# AI Advisory chat + actions                     |
|                                                                       |
| │ │ └── settings/page.tsx \# User preferences                         |
|                                                                       |
| │ ├── api/ \# API Routes                                              |
|                                                                       |
| │ │ ├── transactions/ \# CRUD endpoints                               |
|                                                                       |
| │ │ ├── assets/ \# Asset management                                   |
|                                                                       |
| │ │ ├── portfolio/ \# Portfolio analytics                             |
|                                                                       |
| │ │ ├── budget/ \# Budget CRUD + alerts                               |
|                                                                       |
| │ │ ├── goals/ \# Goals engine                                        |
|                                                                       |
| │ │ ├── net-worth/ \# Net worth aggregation                           |
|                                                                       |
| │ │ ├── health-score/ \# Financial health score                       |
|                                                                       |
| │ │ ├── import/ \# CSV upload & processing                            |
|                                                                       |
| │ │ ├── prices/ \# Real-time price proxy                              |
|                                                                       |
| │ │ ├── insights/ \# Rule-based insights                              |
|                                                                       |
| │ │ └── ai/ \# AI advisory endpoints                                  |
|                                                                       |
| │ ├── layout.tsx \# Root layout (ClerkProvider)                       |
|                                                                       |
| │ └── globals.css                                                     |
|                                                                       |
| │                                                                     |
|                                                                       |
| ├── src/                                                              |
|                                                                       |
| │ ├── services/ \# Core Business Logic                                |
|                                                                       |
| │ │ ├── transaction.service.ts                                        |
|                                                                       |
| │ │ ├── asset.service.ts                                              |
|                                                                       |
| │ │ ├── portfolio.service.ts                                          |
|                                                                       |
| │ │ ├── budget.service.ts                                             |
|                                                                       |
| │ │ ├── goal.service.ts                                               |
|                                                                       |
| │ │ ├── net-worth.service.ts                                          |
|                                                                       |
| │ │ ├── health-score.service.ts                                       |
|                                                                       |
| │ │ ├── price-engine.service.ts                                       |
|                                                                       |
| │ │ ├── import.service.ts                                             |
|                                                                       |
| │ │ ├── insights.service.ts                                           |
|                                                                       |
| │ │ ├── snapshot.service.ts                                           |
|                                                                       |
| │ │ ├── alert.service.ts                                              |
|                                                                       |
| │ │ └── ai/                                                           |
|                                                                       |
| │ │ ├── ai-advisory.service.ts                                        |
|                                                                       |
| │ │ ├── prompt-builder.service.ts                                     |
|                                                                       |
| │ │ └── minimax-client.ts                                             |
|                                                                       |
| │ ├── lib/                                                            |
|                                                                       |
| │ │ ├── prisma.ts \# Prisma client singleton                          |
|                                                                       |
| │ │ ├── redis.ts \# Redis client                                      |
|                                                                       |
| │ │ ├── cache.ts \# Cache helpers                                     |
|                                                                       |
| │ │ ├── validators/ \# Zod schemas                                    |
|                                                                       |
| │ │ ├── errors/ \# Custom error classes                               |
|                                                                       |
| │ │ └── logger.ts \# Structured logger                                |
|                                                                       |
| │ ├── adapters/ \# Import parsers                                     |
|                                                                       |
| │ │ ├── groww.adapter.ts                                              |
|                                                                       |
| │ │ ├── zerodha.adapter.ts                                            |
|                                                                       |
| │ │ ├── indmoney.adapter.ts                                           |
|                                                                       |
| │ │ └── base.adapter.ts \# Abstract parser interface                  |
|                                                                       |
| │ ├── types/ \# Shared TypeScript types                               |
|                                                                       |
| │ └── utils/ \# Pure utility functions                                |
|                                                                       |
| │                                                                     |
|                                                                       |
| ├── components/ \# Shared UI components                               |
|                                                                       |
| │ ├── charts/ \# Recharts wrappers                                    |
|                                                                       |
| │ ├── cards/ \# Summary cards                                         |
|                                                                       |
| │ ├── tables/ \# Data tables                                          |
|                                                                       |
| │ └── ui/ \# Primitive components                                     |
|                                                                       |
| │                                                                     |
|                                                                       |
| ├── prisma/                                                           |
|                                                                       |
| │ ├── schema.prisma \# Full DB schema                                 |
|                                                                       |
| │ └── migrations/                                                     |
|                                                                       |
| │                                                                     |
|                                                                       |
| ├── jobs/ \# Background cron jobs                                     |
|                                                                       |
| │ ├── price-updater.job.ts                                            |
|                                                                       |
| │ ├── snapshot.job.ts                                                 |
|                                                                       |
| │ ├── alert-dispatcher.job.ts                                         |
|                                                                       |
| │ └── ai-monthly-summary.job.ts                                       |
|                                                                       |
| │                                                                     |
|                                                                       |
| ├── config/                                                           |
|                                                                       |
| │ ├── constants.ts \# Global constants                                |
|                                                                       |
| │ └── ai-prompts.ts \# Prompt templates                               |
|                                                                       |
| │                                                                     |
|                                                                       |
| └── tests/                                                            |
|                                                                       |
| ├── unit/ \# Unit tests per service                                   |
|                                                                       |
| └── integration/ \# API integration tests                             |
+-----------------------------------------------------------------------+

**4. Database Schema Design**

The database is PostgreSQL managed via Prisma ORM. The schema is designed around the User entity as the root, with all financial data scoped per user. Soft deletes (deletedAt) are used on financial records to preserve audit trails.

**4.1 Entity-Relationship Overview**

+-----------------------------------------------------------------------+
| User                                                                  |
|                                                                       |
| ├── transactions\[\] (income / expense records)                       |
|                                                                       |
| ├── assets\[\] (stocks, MF, crypto, real estate, cash)                |
|                                                                       |
| ├── liabilities\[\] (loans, credit cards, mortgages)                  |
|                                                                       |
| ├── goals\[\] (financial targets with progress)                       |
|                                                                       |
| ├── budgets\[\] (monthly category-level spend limits)                 |
|                                                                       |
| ├── snapshots\[\] (daily net worth history)                           |
|                                                                       |
| ├── allocationTargets (desired portfolio allocation %)                |
|                                                                       |
| └── aiConversations\[\] (full chat + advisory history)                |
+-----------------------------------------------------------------------+

**4.2 Core Entity Schemas**

**User**

  --------------------------------------------------------------------------
  **Field**             **Type**         **Notes**
  --------------------- ---------------- -----------------------------------
  id                    String (CUID)    Primary key

  clerkId               String           Clerk external user ID --- unique

  email                 String           Unique, indexed

  name                  String?          Display name

  currency              String           Default: INR

  privacyMode           Boolean          Hides amounts in UI

  createdAt             DateTime         Auto

  updatedAt             DateTime         Auto
  --------------------------------------------------------------------------

**Asset**

  ------------------------------------------------------------------------------------------------
  **Field**               **Type**         **Notes**
  ----------------------- ---------------- -------------------------------------------------------
  id                      String (CUID)    Primary key

  userId                  String           FK → User

  type                    Enum             STOCK \| MUTUAL_FUND \| CRYPTO \| REAL_ESTATE \| CASH

  name                    String           Display name (e.g. HDFC Bank)

  ticker / symbol         String?          NSE/BSE symbol, crypto id

  quantity                Decimal          Units held

  avgBuyPrice             Decimal          Average cost basis

  currentPrice            Decimal          Latest fetched price

  currency                String           INR / USD

  account                 String?          Broker or wallet label

  importSource            String?          Groww / Zerodha / manual

  createdAt / updatedAt   DateTime         Auto

  deletedAt               DateTime?        Soft delete
  ------------------------------------------------------------------------------------------------

**Transaction**

  ------------------------------------------------------------------------
  **Field**             **Type**         **Notes**
  --------------------- ---------------- ---------------------------------
  id                    String (CUID)    Primary key

  userId                String           FK → User

  type                  Enum             INCOME \| EXPENSE \| TRANSFER

  amount                Decimal          Always positive

  category              String           e.g. Food, Salary, SIP

  description           String?          Free-text note

  date                  DateTime         Transaction date

  account               String?          Bank account label

  tags                  String\[\]       Optional labels

  createdAt             DateTime         Auto

  deletedAt             DateTime?        Soft delete
  ------------------------------------------------------------------------

**Liability**

  -------------------------------------------------------------------------------------------------------
  **Field**             **Type**         **Notes**
  --------------------- ---------------- ----------------------------------------------------------------
  id                    String (CUID)    PK

  userId                String           FK → User

  type                  Enum             HOME_LOAN \| CAR_LOAN \| PERSONAL_LOAN \| CREDIT_CARD \| OTHER

  name                  String           e.g. SBI Home Loan

  principalAmount       Decimal          Original loan amount

  outstandingAmount     Decimal          Current outstanding

  interestRate          Decimal          Annual %

  monthlyEMI            Decimal?         EMI amount

  dueDate               DateTime?        Next payment due
  -------------------------------------------------------------------------------------------------------

**Goal**

  ------------------------------------------------------------------------
  **Field**             **Type**         **Notes**
  --------------------- ---------------- ---------------------------------
  id                    String (CUID)    PK

  userId                String           FK → User

  name                  String           e.g. Retirement Fund

  targetAmount          Decimal          Goal value in base currency

  currentAmount         Decimal          Current saved/invested

  targetDate            DateTime         Deadline

  monthlyRequired       Decimal          Computed by GoalsService

  status                Enum             ACTIVE \| COMPLETED \| PAUSED
  ------------------------------------------------------------------------

**Snapshot (Net Worth History)**

  -------------------------------------------------------------------------
  **Field**             **Type**         **Notes**
  --------------------- ---------------- ----------------------------------
  id                    String (CUID)    PK

  userId                String           FK → User

  date                  DateTime         Snapshot date (daily, 00:00 UTC)

  totalAssets           Decimal          Sum of all asset values

  totalLiabilities      Decimal          Sum of outstanding liabilities

  netWorth              Decimal          totalAssets - totalLiabilities

  breakdown             Json             Per-asset-type breakdown
  -------------------------------------------------------------------------

**Budget**

  ------------------------------------------------------------------------
  **Field**             **Type**         **Notes**
  --------------------- ---------------- ---------------------------------
  id                    String (CUID)    PK

  userId                String           FK → User

  category              String           Matches Transaction.category

  monthlyLimit          Decimal          Spend cap

  month                 Int              1--12

  year                  Int              e.g. 2025

  alertAt80             Boolean          Send alert at 80% usage

  alertAt100            Boolean          Send alert at 100%
  ------------------------------------------------------------------------

**AllocationTarget**

  ----------------------------------------------------------------------------------------------
  **Field**             **Type**         **Notes**
  --------------------- ---------------- -------------------------------------------------------
  id                    String (CUID)    PK

  userId                String           FK → User

  assetType             Enum             STOCK \| MUTUAL_FUND \| CRYPTO \| REAL_ESTATE \| CASH

  targetPercent         Decimal          Desired allocation %
  ----------------------------------------------------------------------------------------------

**AIConversation**

  ---------------------------------------------------------------------------------------------------------
  **Field**             **Type**         **Notes**
  --------------------- ---------------- ------------------------------------------------------------------
  id                    String (CUID)    PK

  userId                String           FK → User

  action                String           PORTFOLIO_ANALYSIS \| SUGGEST_INVESTMENTS \| CUSTOM_CHAT \| \...

  messages              Json\[\]         Full message history: { role, content, timestamp }

  contextSnapshot       Json             Frozen financial context at request time

  createdAt             DateTime         Auto
  ---------------------------------------------------------------------------------------------------------

**5. Backend Service Layer Design**

Each service is a stateless class with injected Prisma and Cache dependencies. Services never import other services directly --- they communicate through well-defined interfaces. API route handlers are thin wrappers that delegate entirely to services.

**5.1 Service Responsibilities**

  --------------------------------------------------------------------------------------------------------------------
  **Service**          **Responsibility**                              **Key Methods**
  -------------------- ----------------------------------------------- -----------------------------------------------
  TransactionService   CRUD for income/expense, monthly aggregations   create, list, summarizeByMonth, categorySplit

  AssetService         Asset CRUD, price injection, P&L computation    upsert, getPortfolioWithPL, updatePrices

  PortfolioService     Allocation analysis, diversification, risk      getAllocation, getRiskScore, getRebalancePlan

  BudgetService        Budget limits, spend tracking, alert triggers   upsert, getUsage, checkAlerts

  GoalService          Goal creation, progress, monthly calc           create, computeProgress, getMonthlyRequired

  NetWorthService      Asset-liability aggregation, trend data         getCurrent, getHistory, computeBreakdown

  HealthScoreService   0-10 score from 5 financial dimensions          compute, getBreakdown

  PriceEngineService   External price fetching, caching, retries       fetchStock, fetchMF, fetchCrypto, refreshAll

  ImportService        CSV parsing, normalization, dedup, persist      processFile, detectBroker, normalize, persist

  InsightsService      Rule engine + AI insights aggregation           generateRuleBased, enrichWithAI, getAll

  SnapshotService      Daily net worth snapshot creation               takeSnapshot, getHistory

  AlertService         Budget alerts, goal milestones, price alerts    evaluate, dispatch

  AIAdvisoryService    Minimax API integration, context building       runAction, chat, buildContext
  --------------------------------------------------------------------------------------------------------------------

**5.2 Price Engine Architecture**

+-------------------------------------------------------------------------------------------------------------------------------+
| **Price Engine Design**                                                                                                       |
|                                                                                                                               |
| -   Abstracts over multiple external price sources behind a unified PriceProvider interface                                   |
|                                                                                                                               |
| -   Each provider (NSE, BSE, CoinGecko, MF API) is a separate adapter implementing fetchPrice(symbol): Promise\<PriceResult\> |
|                                                                                                                               |
| -   PriceEngineService selects the correct provider based on asset type                                                       |
|                                                                                                                               |
| -   All prices are cached in Redis with TTL: 15 min (stocks, market hours), 1 hr (MF NAV), 5 min (crypto)                     |
|                                                                                                                               |
| -   A circuit breaker prevents cascading failures when an external API is down                                                |
|                                                                                                                               |
| -   Stale prices are served from cache with a \'stale\' flag rather than returning an error                                   |
+-------------------------------------------------------------------------------------------------------------------------------+

**5.3 Financial Health Score Engine**

The health score is computed across 5 weighted dimensions. Each dimension returns a 0--2 sub-score, summing to a max of 10.

  ----------------------------------------------------------------------------------------------------------------------
  **Dimension**               **Weight**   **Metric Logic**
  --------------------------- ------------ -----------------------------------------------------------------------------
  Savings Rate                2.0          Monthly savings / Monthly income. \>20% = 2.0, 10--20% = 1.0, \<10% = 0

  Debt-to-Income Ratio        2.0          Monthly EMI / Monthly income. \<30% = 2.0, 30--50% = 1.0, \>50% = 0

  Investment Allocation       2.0          Invested assets / Net worth. \>40% = 2.0, 20--40% = 1.0, \<20% = 0

  Goal Progress               2.0          Avg % completion across active goals. \>70% = 2.0, 40--70% = 1.0, \<40% = 0

  Portfolio Diversification   2.0          Asset type spread vs allocation targets. On-target = 2.0, partial = 1.0
  ----------------------------------------------------------------------------------------------------------------------

**6. Key Data Flows**

**6.1 CSV Import Flow**

+-----------------------------------------------------------------------+
| User uploads CSV (Groww / Zerodha / INDmoney)                         |
|                                                                       |
| │                                                                     |
|                                                                       |
| ▼                                                                     |
|                                                                       |
| ImportService.processFile(file, userId, source)                       |
|                                                                       |
| ├─ detectBroker(headers) → selects adapter                            |
|                                                                       |
| ├─ adapter.parse(csv) → raw rows\[\]                                  |
|                                                                       |
| ├─ adapter.normalize() → NormalizedHolding\[\]                        |
|                                                                       |
| │ { symbol, name, qty, avgPrice, assetType, currency }                |
|                                                                       |
| ├─ deduplicateAgainstExisting(userId, holdings)                       |
|                                                                       |
| │ mode: APPEND (add new) \| UPDATE (update price/qty)                 |
|                                                                       |
| ├─ PriceEngineService.enrichWithCurrentPrice(holdings)                |
|                                                                       |
| └─ AssetService.bulkUpsert(userId, enrichedHoldings)                  |
|                                                                       |
| │                                                                     |
|                                                                       |
| ▼                                                                     |
|                                                                       |
| ImportReport { added: N, updated: M, skipped: K, errors: \[\] }       |
+-----------------------------------------------------------------------+

**6.2 Real-Time Price Update Flow**

+-----------------------------------------------------------------------+
| Cron Job (every 15 min, market hours) / On-demand API call            |
|                                                                       |
| │                                                                     |
|                                                                       |
| ▼                                                                     |
|                                                                       |
| PriceEngineService.refreshAll(userId)                                 |
|                                                                       |
| ├─ Fetch all distinct symbols from assets table                       |
|                                                                       |
| ├─ Group by asset type → route to correct provider                    |
|                                                                       |
| │ STOCK/ETF → NSE/BSE API adapter                                     |
|                                                                       |
| │ MF → MF API India (NAV endpoint)                                    |
|                                                                       |
| │ CRYPTO → CoinGecko API adapter                                      |
|                                                                       |
| ├─ Redis check: return cached price if TTL valid                      |
|                                                                       |
| ├─ HTTP call to provider (with retry: 3 attempts, exp backoff)        |
|                                                                       |
| ├─ Store in Redis cache with asset-type-specific TTL                  |
|                                                                       |
| └─ Batch UPDATE assets.currentPrice in PostgreSQL                     |
|                                                                       |
| │                                                                     |
|                                                                       |
| ▼                                                                     |
|                                                                       |
| NetWorthService.invalidateCache(userId) ← triggers recalculation      |
+-----------------------------------------------------------------------+

**6.3 AI Advisory Request Flow**

+-----------------------------------------------------------------------+
| User selects action (e.g. \'Analyze My Portfolio\')                   |
|                                                                       |
| │                                                                     |
|                                                                       |
| ▼                                                                     |
|                                                                       |
| POST /api/ai { action: \'PORTFOLIO_ANALYSIS\', message?: string }     |
|                                                                       |
| │                                                                     |
|                                                                       |
| ▼                                                                     |
|                                                                       |
| AIAdvisoryService.runAction(userId, action, message)                  |
|                                                                       |
| ├─ buildContext(userId)                                               |
|                                                                       |
| │ ├─ NetWorthService.getCurrent(userId)                               |
|                                                                       |
| │ ├─ PortfolioService.getAllocation(userId)                           |
|                                                                       |
| │ ├─ TransactionService.summarizeByMonth(userId, last3)               |
|                                                                       |
| │ ├─ HealthScoreService.compute(userId)                               |
|                                                                       |
| │ └─ GoalService.getAllWithProgress(userId)                           |
|                                                                       |
| ├─ PromptBuilderService.build(action, context, message)               |
|                                                                       |
| │ → Structured prompt with system role + data context + instruction   |
|                                                                       |
| ├─ MinimaxClient.send(prompt, { stream: true })                       |
|                                                                       |
| ├─ Stream response tokens back to client via SSE                      |
|                                                                       |
| └─ Persist { action, messages, contextSnapshot } → AIConversation     |
+-----------------------------------------------------------------------+

**6.4 Dashboard Rendering Flow**

+-----------------------------------------------------------------------+
| User opens Dashboard (GET /dashboard)                                 |
|                                                                       |
| │                                                                     |
|                                                                       |
| ▼                                                                     |
|                                                                       |
| Next.js Server Component fetches in parallel:                         |
|                                                                       |
| ├─ NetWorthService.getCurrent() → net worth card                      |
|                                                                       |
| ├─ TransactionService.summarize() → monthly P&L                       |
|                                                                       |
| ├─ BudgetService.getUsage() → budget progress bars                    |
|                                                                       |
| ├─ PortfolioService.getAllocation() → allocation chart data           |
|                                                                       |
| ├─ HealthScoreService.compute() → score card                          |
|                                                                       |
| ├─ GoalService.getAllWithProgress() → goals panel                     |
|                                                                       |
| └─ InsightsService.getLatest() → insights feed                        |
|                                                                       |
| │                                                                     |
|                                                                       |
| ▼                                                                     |
|                                                                       |
| All served from Redis cache (invalidated on data mutation)            |
|                                                                       |
| │                                                                     |
|                                                                       |
| ▼                                                                     |
|                                                                       |
| Hydrate client components (charts, interactive filters)               |
+-----------------------------------------------------------------------+

**7. AI Advisory System Design**

The AI module is a first-class system component, not a bolt-on feature. It is designed around structured prompt templates, contextual financial data injection, and deterministic action routing --- ensuring outputs are explainable, consistent, and safe.

**7.1 AI Actions Catalog**

  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Action ID**         **Trigger**                         **Context Injected**                                            **Output Format**
  --------------------- ----------------------------------- --------------------------------------------------------------- -----------------------------------------------
  PORTFOLIO_ANALYSIS    User clicks \'Analyze Portfolio\'   Full portfolio, allocation, P&L, risk score                     Structured: strengths, risks, recommendations

  SUGGEST_INVESTMENTS   User requests suggestions           Health score, goals, current allocation, risk tolerance         Ranked suggestion list with rationale

  REBALANCING_ADVICE    Auto or manual trigger              Current vs target allocation, asset values                      Step-by-step rebalancing plan

  MARKET_INSIGHTS       User requests insights              Held stocks/MFs, current prices, recent news (via web search)   Relevant market commentary

  FINANCIAL_ROADMAP     User sets up profile                Goals, income, expenses, timeline, net worth                    Month-by-month investment roadmap

  CUSTOM_CHAT           User types free message             Full financial context                                          Free-form response with data grounding

  MONTHLY_SUMMARY       Monthly cron job                    Last 30 days transactions, budget usage, portfolio delta        Narrative summary + 3 action items
  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**7.2 Prompt Builder Service**

The PromptBuilderService transforms raw financial context into structured, token-efficient prompts. It is the single source of truth for all AI instructions.

+-----------------------------------------------------------------------+
| PromptBuilderService.build(action, context, userMessage?)             |
|                                                                       |
| Output Structure:                                                     |
|                                                                       |
| ─────────────────────────────────────────────────                     |
|                                                                       |
| SYSTEM ROLE                                                           |
|                                                                       |
| You are a SEBI-registered financial advisor AI\...                    |
|                                                                       |
| Guidelines: evidence-based, no guaranteed returns,                    |
|                                                                       |
| India-specific tax context, INR currency default.                     |
|                                                                       |
| FINANCIAL CONTEXT (JSON-structured)                                   |
|                                                                       |
| netWorth: { total, assets, liabilities, trend }                       |
|                                                                       |
| portfolio: { allocation\[\], topHoldings\[\], riskScore }             |
|                                                                       |
| cashFlow: { income, expenses, savingsRate, last3Months }              |
|                                                                       |
| goals: \[ { name, target, current, progress, deadline } \]            |
|                                                                       |
| healthScore: { total, breakdown }                                     |
|                                                                       |
| TASK INSTRUCTION (action-specific)                                    |
|                                                                       |
| \[PORTFOLIO_ANALYSIS\] Analyze the portfolio\...                      |
|                                                                       |
| Respond in this JSON schema: { strengths\[\], risks\[\],              |
|                                                                       |
| recommendations\[\], confidenceLevel: \'HIGH\'\|\'MED\'\|\'LOW\' }    |
|                                                                       |
| USER MESSAGE (optional free text)                                     |
|                                                                       |
| ─────────────────────────────────────────────────                     |
+-----------------------------------------------------------------------+

**7.3 Minimax API Integration**

  ---------------------------------------------------------------------------------------------------
  **Aspect**             **Design Decision**
  ---------------------- ----------------------------------------------------------------------------
  Model                  MiniMax abab6.5-chat (high context, JSON mode)

  Streaming              Server-Sent Events (SSE) for real-time token streaming to UI

  JSON Mode              Enabled for structured action outputs; disabled for CUSTOM_CHAT

  Temperature            0.3 for advisory actions (consistency), 0.7 for custom chat

  Max Tokens             2048 for analysis actions, 4096 for roadmap / monthly summary

  Retry Policy           3 retries with exponential backoff on 5xx; fallback to rule-based insights

  Rate Limiting          Per-user: 10 AI requests/hour. Global: tracked via Redis counters

  Cost Control           Context is trimmed: only last 3 months of transactions, top 10 holdings
  ---------------------------------------------------------------------------------------------------

**7.4 AI Safety & Explainability**

-   All AI outputs include a confidenceLevel field (HIGH / MEDIUM / LOW)

-   Outputs reference specific portfolio data points, not generic advice

-   System prompt explicitly instructs: no guaranteed return claims, SEBI-compliant disclaimers

-   Every AI response is stored with the frozen contextSnapshot used to generate it

-   Rule-based InsightsService runs in parallel as a fallback if AI call fails

**8. Scalability & Infrastructure**

**8.1 Caching Strategy**

  ----------------------------------------------------------------------------------------------------
  **Data Type**    **Cache Layer**           **TTL**                 **Invalidation**
  ---------------- ------------------------- ----------------------- ---------------------------------
  Stock prices     Redis (string)            15 min (market hours)   On cron refresh

  MF NAV           Redis (string)            1 hour                  On cron refresh

  Crypto prices    Redis (string)            5 min                   On cron refresh

  Net worth        Redis (hash)              30 min                  On any asset/liability mutation

  Dashboard data   Redis (hash)              10 min                  On any financial mutation

  Health score     Redis (string)            1 hour                  On transaction/asset change

  AI context       In-memory (per request)   Request lifetime        N/A --- rebuilt per call
  ----------------------------------------------------------------------------------------------------

**8.2 Background Jobs (Cron Schedule)**

  -------------------------------------------------------------------------------------------------------------
  **Job**               **Schedule**                         **Description**
  --------------------- ------------------------------------ --------------------------------------------------
  PriceUpdaterJob       Every 15 min (Mon-Fri 9am-4pm IST)   Refresh all asset prices for active users

  SnapshotJob           Daily at 11:59pm IST                 Record net worth snapshot for all users

  AlertDispatcherJob    Every 30 min                         Check budget/goal thresholds, send notifications

  AIMonthlySummaryJob   1st of each month, 7am IST           Generate AI financial summary for active users

  PortfolioHealthJob    Weekly, Sunday midnight              Recompute health scores, flag drift from targets
  -------------------------------------------------------------------------------------------------------------

**8.3 Rate Limiting**

  ------------------------------------------------------------------------------
  **Endpoint Group**                **Limit**          **Window**
  --------------------------------- ------------------ -------------------------
  General API routes                100 req/user       Per minute

  Import endpoint                   5 uploads/user     Per hour

  AI advisory endpoints             10 req/user        Per hour

  Price fetch proxy                 30 req/user        Per minute

  Public endpoints (health check)   1000 req           Per minute
  ------------------------------------------------------------------------------

**9. Security Design**

**9.1 Authentication & Authorization**

-   All routes are protected by Clerk middleware at the Next.js edge layer

-   JWT tokens are verified on every API request; userId is extracted server-side --- never trusted from client

-   Every Prisma query includes a where: { userId } clause --- enforced at service layer

-   Service functions accept userId as a mandatory parameter, preventing cross-user data access

-   Admin routes (if any) are gated by Clerk organization roles

**9.2 Input Validation**

-   All API route inputs validated with Zod schemas before reaching services

-   CSV imports are scanned for max row count (50,000), max file size (10MB), and header whitelist

-   All decimal fields validated for precision and range --- prevents financial data corruption

-   Parameterized queries via Prisma ORM --- no raw SQL string concatenation

**9.3 API & Data Protection**

  ------------------------------------------------------------------------------------------------------------
  **Concern**                     **Mitigation**
  ------------------------------- ----------------------------------------------------------------------------
  IDOR (cross-user data access)   All DB queries include userId scoping at service layer

  CSRF                            SameSite cookies + Clerk CSRF protection

  XSS                             Next.js auto-escaping, CSP headers

  SQL Injection                   Prisma parameterized queries only

  Sensitive data exposure         Financial amounts never logged; Privacy Mode available in UI

  AI prompt injection             User input is injected into prompts as data context, never as instructions

  API key exposure                All external API keys in environment variables, never client-side

  Import malware                  CSV-only format enforced; no executable content allowed
  ------------------------------------------------------------------------------------------------------------

**10. Error Handling Strategy**

**10.1 Error Class Hierarchy**

+-----------------------------------------------------------------------+
| AppError (base)                                                       |
|                                                                       |
| ├── ValidationError (400) --- invalid input schema                    |
|                                                                       |
| ├── AuthError (401) --- missing or invalid token                      |
|                                                                       |
| ├── ForbiddenError (403) --- userId mismatch                          |
|                                                                       |
| ├── NotFoundError (404) --- resource not found                        |
|                                                                       |
| ├── ConflictError (409) --- duplicate import, etc.                    |
|                                                                       |
| ├── ExternalAPIError (502) --- price API / AI API failure             |
|                                                                       |
| └── InternalError (500) --- unhandled service failure                 |
+-----------------------------------------------------------------------+

**10.2 API Error Response Contract**

+-----------------------------------------------------------------------+
| {                                                                     |
|                                                                       |
| \"error\": {                                                          |
|                                                                       |
| \"code\": \"VALIDATION_ERROR\",                                       |
|                                                                       |
| \"message\": \"quantity must be a positive number\",                  |
|                                                                       |
| \"field\": \"quantity\",                                              |
|                                                                       |
| \"requestId\": \"req_abc123xyz\"                                      |
|                                                                       |
| }                                                                     |
|                                                                       |
| }                                                                     |
+-----------------------------------------------------------------------+

**10.3 Resilience Patterns**

  ------------------------------------------------------------------------------------------------------------
  **Pattern**            **Applied To**               **Behavior**
  ---------------------- ---------------------------- --------------------------------------------------------
  Circuit Breaker        External price APIs          Open after 5 failures in 60s; serve stale cached price

  Retry with Backoff     Minimax AI API, price APIs   3 retries, 1s/2s/4s delays

  Graceful Degradation   AI Advisory module           If Minimax fails, return rule-based insights

  Idempotency            CSV import endpoint          Hash-based deduplication prevents duplicate assets

  Timeout                All external HTTP calls      5s default, 15s for AI streaming
  ------------------------------------------------------------------------------------------------------------

**11. Observability & Monitoring**

**11.1 Structured Logging**

All logs are emitted as structured JSON using a centralized logger (e.g., Pino). Every log line includes: timestamp, level, requestId, userId (hashed), service, method, durationMs, and outcome.

+------------------------------------------------------------------------------+
| { \"level\": \"info\", \"requestId\": \"req_abc\", \"userId\": \"hash_xyz\", |
|                                                                              |
| \"service\": \"PortfolioService\", \"method\": \"getAllocation\",            |
|                                                                              |
| \"durationMs\": 42, \"cacheHit\": true, \"assetCount\": 12 }                 |
|                                                                              |
| { \"level\": \"warn\", \"service\": \"PriceEngineService\",                  |
|                                                                              |
| \"provider\": \"NSE\", \"symbol\": \"INFY\", \"error\": \"timeout\",         |
|                                                                              |
| \"fallback\": \"stale_cache\", \"staleSinceMs\": 900000 }                    |
+------------------------------------------------------------------------------+

**11.2 Key Metrics to Monitor**

  ---------------------------------------------------------------------------------
  **Metric**                   **Source**           **Alert Threshold**
  ---------------------------- -------------------- -------------------------------
  API p95 latency              Request middleware   \> 500ms

  AI advisory latency          AIAdvisoryService    \> 8s

  Price refresh success rate   PriceEngineService   \< 95%

  Import error rate            ImportService        \> 5% of rows

  Redis cache hit ratio        Cache layer          \< 70%

  DB connection pool           Prisma metrics       \> 80% pool usage

  Background job failures      Job runner           Any single failure

  Error rate by endpoint       API middleware       \> 1% 5xx rate
  ---------------------------------------------------------------------------------

**12. Advanced Features**

**12.1 Scenario Simulator**

The Scenario Simulator allows users to model hypothetical future financial states by adjusting parameters such as monthly investment amount, expected return rate, and goal timeline. It runs on the client using a deterministic compound interest model, with optional AI enrichment to factor in India-specific market conditions.

-   Input parameters: current invested amount, monthly SIP, expected CAGR, years

-   Output: projected wealth chart (year-by-year), inflation-adjusted values, goal feasibility

-   Powered by client-side JavaScript --- no server round-trip needed for basic projection

-   AI enrichment: user can ask \'Is 12% CAGR realistic for my portfolio?\' --- triggers AI advisory

**12.2 Portfolio Rebalancing Engine**

The rebalancing engine compares the user\'s current asset allocation against their AllocationTarget and generates an actionable rebalancing plan.

+-----------------------------------------------------------------------+
| RebalancingEngine.computePlan(userId):                                |
|                                                                       |
| current = PortfolioService.getAllocation(userId)                      |
|                                                                       |
| targets = AllocationTargetService.get(userId)                         |
|                                                                       |
| drift = current - targets (per asset type)                            |
|                                                                       |
| For each drifted asset type:                                          |
|                                                                       |
| if drift \> THRESHOLD (default: 5%):                                  |
|                                                                       |
| generate BUY/SELL recommendation with INR amount                      |
|                                                                       |
| Output: RebalancePlan\[\]                                             |
|                                                                       |
| { assetType, currentPct, targetPct, driftPct,                         |
|                                                                       |
| action: \'BUY\'\|\'SELL\', suggestedAmount: Decimal }                 |
+-----------------------------------------------------------------------+

**12.3 Smart Alerts System**

  ------------------------------------------------------------------------------------------------------------
  **Alert Type**           **Trigger Condition**                                   **Delivery**
  ------------------------ ------------------------------------------------------- ---------------------------
  Budget Warning (80%)     Category spend reaches 80% of monthly limit             In-app banner + email

  Budget Exceeded (100%)   Category spend exceeds monthly limit                    In-app + email (urgent)

  Goal Milestone           Goal progress crosses 25%, 50%, 75%, 100%               In-app notification

  Portfolio Drift          Any asset type drifts \>5% from target allocation       Weekly digest

  Large Transaction        Single transaction \> 3x monthly average for category   Instant in-app

  Stale Data               Price data older than 24h for any held asset            Dashboard warning

  AI Monthly Summary       End of each month                                       Email + in-app report
  ------------------------------------------------------------------------------------------------------------

**12.4 Multi-Account Support**

-   Each Asset record has an account field (e.g. \'Zerodha Demat\', \'HDFC Savings\', \'Binance\')

-   Dashboard supports filtering all views by account

-   Net worth and allocation charts show per-account breakdown as well as aggregate

-   Import system maps CSV source to account label automatically

**12.5 Privacy Mode**

-   Global toggle stored on the User entity (privacyMode: Boolean)

-   When enabled, all monetary amounts are replaced with \*\*\* in the UI

-   Charts show relative proportions but not absolute values

-   Privacy mode is a pure UI transformation --- amounts are always stored unmasked in DB

**13. API Route Reference**

  ---------------------------------------------------------------------------------------------------
  **Method**              **Route**                  **Service**          **Description**
  ----------------------- -------------------------- -------------------- ---------------------------
  GET                     /api/dashboard             Multiple             Aggregated dashboard data

  GET/POST/DELETE         /api/transactions          TransactionService   CRUD for income/expense

  GET/POST/PATCH/DELETE   /api/assets                AssetService         Asset management

  GET                     /api/portfolio             PortfolioService     Allocation, P&L, risk

  GET                     /api/portfolio/rebalance   PortfolioService     Rebalancing plan

  GET/POST/PATCH          /api/budget                BudgetService        Budget CRUD + usage

  GET/POST/PATCH          /api/goals                 GoalService          Goals + progress

  GET                     /api/net-worth             NetWorthService      Current + historical

  GET                     /api/health-score          HealthScoreService   Score + breakdown

  POST                    /api/import                ImportService        CSV upload + processing

  GET                     /api/prices/:symbol        PriceEngineService   Real-time price lookup

  GET                     /api/insights              InsightsService      Latest insights feed

  POST                    /api/ai                    AIAdvisoryService    AI action + chat (SSE)

  GET                     /api/ai/history            AIAdvisoryService    Past AI conversations
  ---------------------------------------------------------------------------------------------------
