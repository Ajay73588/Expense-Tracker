# FinBoom Website Audit and Feature Specification

<text color="secondary" size="sm">Audit target: https://www.finboom.app/ · Reference date: October 9, 2026</text>

This report will distinguish **observed functionality**, **interactions verified through available evidence**, and **features that require further investigation**. The objective is to produce an implementation-oriented specification for building a comparable personal finance application, not to reproduce FinBoom's branding or proprietary assets.

The supplied dashboard establishes several important starting points: FinBoom is positioned as a privacy-first personal finance app, with navigation for wealth, transactions, essentials, imports, calculators, updates, and settings. Its dashboard also exposes net worth, assets, liabilities, monthly cash flow, recent activity, investments, snapshots, and financial goals.

One important limitation: I don't have a live browser-control session in this conversation that lets me click through the signed-in website and observe every resulting state. I can examine the supplied page information and investigate publicly accessible website routes, but I will not describe an interaction as tested unless there is evidence for it. Features that require an account, user data, or Pro access will be marked accordingly.

## 1. Website Overview

<row align=start gap={3}>
  <box flex="1" gap={1}>
    <title size="lg">FinBoom</title>
    <text color="secondary" size="sm">Personal finance and wealth tracking</text>
    FinBoom consolidates personal wealth, investments, debts, income, expenses, and financial goals into one dashboard. It emphasizes manual data entry and spreadsheet imports instead of requiring bank or brokerage credentials. <Cite refs={["turn687444search0","turn687444search2"]}/>
    <text color="secondary" size="sm">Website: [finboom.app](https://www.finboom.app/)</text>
  </box>
  <AsyncImage query="personal finance wealth tracking dashboard net worth investments expenses clean web app interface" aspectRatio="4:3" width="124px"/>
</row>

### 1.1 Target users

- Individuals tracking their net worth across different asset classes.
- Investors with stocks, mutual funds, retirement savings, property, gold, and other holdings.
- People tracking household income, expenses, liabilities, and savings goals.
- Users importing portfolios and transactions from broker or bank statements.
- Families and business owners who need separate financial profiles and consolidated reporting.

These user groups are inferred from the site's advertised features, not from a verified customer demographic study. <Cite refs={["turn687444search0","turn687444search1"]}/>

### 1.2 Core value proposition

| Capability | User benefit |
|---|---|
| Consolidated wealth tracking | Understand assets, liabilities, and net worth together. |
| Money management | Track income, expenses, transfers, and spending patterns. |
| Investment tracking | Organize multiple asset classes and currencies. |
| Data import | Reduce manual entry using supported financial exports. |
| Financial planning | Track goals, budgets, insurance, and emergency savings. |
| Historical tracking | Capture and compare net worth over time. |
| Privacy-oriented design | Control what financial information is entered and imported. |
| Financial calculators | Model investment returns, recurring investments, and loan payments. |

The public website advertises support for more than 20 asset classes and multi-currency tracking. The supplied dashboard identifies INR as its current display currency. Currency counts differ across public pages and dated product announcements, so the exact current supported count requires confirmation. <Cite refs={["turn687444search0","turn687444search1","turn687444search2"]}/>

### 1.3 Evidence and verification conventions

The report uses the following labels:

- <badge color="success">Observed</badge> Directly present in the supplied page or an accessible public page.
- <badge color="info">Documented</badge> Described in official product documentation or release notes, but not independently exercised in this audit.
- <badge color="warning">Unverified</badge> Requires an authenticated session, a suitable account, or direct interaction.
- <badge>Inferred</badge> A reasonable implementation conclusion, not a confirmed internal design.

**Audit boundary:** The dashboard's rendered content was supplied in the conversation. Directly opening `/dashboard` without that session redirected to `/login?callbackUrl=/dashboard`. Consequently, this report can document the supplied dashboard and public product documentation, but cannot claim to have exhaustively tested the authenticated application. <Cite refs={["turn687444view0","turn687444search1"]}/>

---

## 2. Complete Feature Inventory

This inventory groups the features into functional modules. Detailed specifications, priorities, and implementation complexity appear in later sections.

<text color="secondary" size="sm">Priority is my assessment for a comparable product, not FinBoom's internal roadmap. Evidence status describes the available evidence, not feature quality.</text>

### 2.1 Dashboard and overview

| Feature | Purpose | Evidence |
|---|---|---|
| Net worth summary | Present consolidated financial position | Observed |
| Asset and liability summary | Show holdings and debts | Observed |
| Asset/liability allocation | Show the proportion of each side of the balance sheet | Observed |
| Monthly cash-flow summary | Show monthly income and expenses | Observed in dashboard; further details documented |
| Recent activity | Show recent recorded transactions | Observed |
| Quick-add actions | Navigate to expense, asset, snapshot, and import flows | Observed |
| Investments summary | Surface investment performance information | Observed; calculation details unverified |
| Goal summary | Show goal count, progress indicator, and off-track count | Observed |
| Privacy toggle | Conceal displayed financial totals | Documented in release notes |
| Financial health score | Summarize financial health | Documented in release notes |
| Navigation to detailed modules | Open assets, liabilities, transactions, and other sections | Observed |

### 2.2 Wealth and assets

| Feature | Purpose | Evidence |
|---|---|---|
| Asset register | Manage financial and physical holdings | Observed/documented |
| Asset-class filtering | Filter holdings by category, such as real estate or equity | Observed |
| Asset creation and editing | Record and maintain individual assets | Routes and release notes |
| Liabilities register | Track loans and other debts | Observed/documented |
| Loan details | Inspect an individual loan | Documented |
| Investment allocation | Break down holdings by investment type | Documented |
| Multi-currency valuation | Normalize asset values into a display currency | Documented |
| Live asset prices | Refresh eligible investment valuations | Documented as a Pro feature |
| Instrument classification | Assign investments to appropriate categories | Documented |
| Investment cost tracking | Store invested amounts alongside current values | Documented |
| Asset tags and geography | Organize assets by metadata | Documented |
| Loan repayment history | Inspect payment and principal/interest breakdowns | Documented |
| Loan amortization schedule | Model loan repayment over time | Documented |
| Loan prepayment calculator | Estimate interest and tenure effects of extra payments | Documented |

### 2.3 Transactions and money management

| Feature | Purpose | Evidence |
|---|---|---|
| Expense tracking | Record and classify spending | Observed/documented |
| Income tracking | Record earnings and other inflows | Observed/documented |
| Account-to-account transfers | Track movements of money | Documented |
| Cross-currency transfers | Record transfers between differently denominated accounts | Documented |
| Transaction filters | Narrow records by period and other criteria | Documented |
| Month grouping | Organize transactions chronologically | Documented |
| Search and selection | Find and select records for bulk operations | Partially documented |
| Bulk categorization | Change categories for multiple transactions | Documented |
| Transaction cloning | Reuse an existing transaction as a template | Documented |
| Transaction tags | Add organizational labels | Documented |
| Running totals | Sum selected transactions | Documented |
| Custom categories | Define and maintain income and expense categories | Documented |
| Category rules | Automatically classify transactions using matching rules | Documented |
| Recurring templates | Schedule regular income and expenses | Documented |
| Budget management | Set and manage a spending plan | Observed by route; details documented |
| Budget-exempt categories | Exclude designated categories from budget calculations | Documented |
| Inline arithmetic | Calculate expressions in amount fields | Documented |

### 2.4 Import and data management

| Feature | Purpose | Evidence |
|---|---|---|
| General CSV import | Import structured transaction data | Documented |
| Spreadsheet template import | Add assets and financial records from templates | Documented |
| Bank statement import | Convert statements into transactions | Documented for supported formats |
| Broker portfolio import | Import stocks, ETFs, and mutual funds | Documented |
| Mutual fund consolidated statement import | Import multiple fund holdings from one statement | Documented |
| Import review and categorization | Review proposed transactions and correct classifications | Documented |
| Duplicate detection | Flag potentially duplicated imported transactions | Documented |
| Account assignment | Link imported records to the appropriate account | Documented |
| Password-protected statement support | Supply a password for an encrypted statement | Documented for MFCentral CAS import |
| Export to CSV and JSON | Extract user data | Documented in privacy policy |
| Import from additional brokers | Support broker-specific export formats | Documented; coverage is format-dependent |
| Import transfers | Include transfers in general transaction imports | Documented |

### 2.5 Financial planning and analysis

| Feature | Purpose | Evidence |
|---|---|---|
| Net worth snapshots | Preserve a historical financial position | Observed/documented |
| Automatic snapshots | Capture financial position on a schedule | Documented as Pro |
| Snapshot comparison | Compare financial positions across dates | Documented |
| Money insights | Analyze income and expenses | Observed by route; details documented |
| Monthly trend chart | Compare income and expenses over time | Documented |
| Category analysis | Break down spending by category | Documented |
| Account-filtered insights | Analyze selected financial accounts | Documented |
| Savings rate | Estimate the share of income saved | Documented |
| Budget analysis | Compare planned and actual spending | Documented |
| Goal tracking | Monitor progress toward financial objectives | Observed/documented |
| Inflation-adjusted goal planning | Estimate the effect of inflation on targets | Documented |
| Financial essentials | Track insurance and emergency savings | Observed/documented |
| Debt ratio | Show a debt-related financial health measure | Documented |
| Financial health score | Provide an overall financial health indicator | Documented |

### 2.6 Calculators

The public product documentation identifies six free financial calculators. <Cite refs={["turn687444search1","turn687444search5","turn687444search6"]}/>

| Calculator | Purpose | Evidence |
|---|---|---|
| XIRR | Estimate annualized returns for dated cash flows | Public page |
| SIP | Project periodic investment growth | Public page |
| Lumpsum | Project returns from a one-time investment | Release notes |
| EMI | Estimate loan payments | Release notes |
| CAGR | Calculate annualized growth | Release notes |
| Fixed-deposit maturity | Estimate maturity value | Release notes |

### 2.7 Settings, account, and platform features

| Feature | Purpose | Evidence |
|---|---|---|
| Account and preferences | Manage personal application settings | Observed by route; details documented |
| Google sign-in | Authenticate through Google | Public landing page |
| Email/password sign-in | Authenticate with email credentials | Login page |
| Account creation | Register a new user | Login page |
| Password recovery | Recover account access | Login page |
| Financial profiles | Separate household or business records | Documented as Pro |
| Consolidated profiles | View combined wealth across profiles | Documented as Pro |
| Shared access | Allow others to view or manage financial data | Documented as Pro |
| App lock | Protect app access with a PIN | Documented |
| Notification settings | Configure selected alerts | Documented |
| Text-size preferences | Adjust application text size | Documented |
| Install app | Install or launch the application through supported platform flows | Observed/documented |
| Feedback | Send suggestions to the product team | Observed |
| What's New | Review product releases and fixes | Public page |
| Subscription management | View or manage Pro access | Observed by route; terms document cancellation |
| Data export | Download personal data | Documented |
| Account deletion | Permanently remove account data | Documented |

### 2.8 Notifications and recurring automation

| Feature | Purpose | Evidence |
|---|---|---|
| Deposit and bond maturity reminders | Notify users of approaching or completed maturities | Documented |
| Email notifications | Deliver supported reminders by email | Documented |
| In-app notification bell | Display notifications within the application | Documented |
| Recurring transaction generation | Create regular transactions from templates | Documented |
| Recurring loan EMI tracking | Record scheduled loan payments | Documented |
| Weekly financial summary email | Deliver a financial summary | Documented in release notes |
| Category-rule application | Reuse classification decisions on future imports | Documented |

**AI-specific functionality:** No dedicated AI assistant or generative AI tool is established by the supplied dashboard or the public product evidence reviewed here. Automated categorization, reminders, calculators, and import processing are not, by themselves, proof of generative AI. An AI module should not be included in a replica specification without additional evidence.

---

## 3. Page and Navigation Inventory

### 3.1 Global navigation

The supplied authenticated dashboard shows the following navigation structure. Routes below are the observed relative paths.

<box border radius="lg" padding={3} gap={2}>
  <row align="center" gap={2}>
    <icon name="layout-dashboard" size="lg"/>
    <box flex="1" gap={1}>
      **Overview**
      <text color="secondary" size="sm">`/dashboard` — financial summary and quick actions</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="landmark" size="lg"/>
    <box flex="1" gap={1}>
      **Wealth**
      <text color="secondary" size="sm">`/assets` — assets and investment holdings</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="wallet" size="lg"/>
    <box flex="1" gap={1}>
      **Money**
      <text color="secondary" size="sm">`/transactions` — income, expenses, and transfers</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="shield-check" size="lg"/>
    <box flex="1" gap={1}>
      **Essentials**
      <text color="secondary" size="sm">`/essentials` — financial safety-net tracking</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="file-up" size="lg"/>
    <box flex="1" gap={1}>
      **Import**
      <text color="secondary" size="sm">`/import` — data ingestion</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="calculator" size="lg"/>
    <box flex="1" gap={1}>
      **Calculators**
      <text color="secondary" size="sm">`/calculators` — public financial tools</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="history" size="lg"/>
    <box flex="1" gap={1}>
      **What's New**
      <text color="secondary" size="sm">`/whats-new` — product release history</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="settings" size="lg"/>
    <box flex="1" gap={1}>
      **Settings**
      <text color="secondary" size="sm">`/settings` — account, preferences, profiles, billing, and data controls</text>
    </box>
  </row>
</box>

The dashboard also exposes an Add action, an Install App option, Feedback, a Pro upgrade link, and a profile control. The exact expanded contents of the Add menu and profile menu have not been inspected.

### 3.2 Page-by-page breakdown

The following inventory separates pages whose public content was examined from routes known only through the supplied dashboard or product documentation.

| Page or route | Purpose and visible content | Actions and relationships | Audit status |
|---|---|---|---|
| `/` | Marketing landing page, product features, sample dashboard, pricing, testimonials, FAQs | Get started, live demo, calculators, privacy, pricing links | Public page inspected |
| `/login` | Authentication page with Google sign-in, email, password, sign-in, forgot-password, and account creation options | Authenticate or register | Public page inspected |
| `/dashboard` | Net worth, monthly activity, assets, liabilities, investment summary, goals, quick-add links | Navigate to financial modules and add records | Supplied dashboard inspected; live route redirects to login |
| `/assets` | Asset list and investment holdings | Add, search, filter, edit, and organize holdings, as documented | Route known; protected content not independently inspected |
| `/assets/new` | New asset workflow | Enter an asset and save it | Route observed; form unverified |
| `/assets?class=REAL_ESTATE` | Real estate filter | Restrict assets by class | Route observed |
| `/assets?class=EQUITY` | Equity filter | Restrict assets by class | Route observed |
| `/liabilities` | Liabilities and debt records | Inspect or manage loans | Route observed |
| `/transactions` | Unified transaction management | Filter, add, edit, categorize, clone, and select transactions | Route observed; detailed behavior documented |
| `/expenses/new` | New expense workflow | Enter and save an expense | Route observed; form unverified |
| `/budget` | Spending plan | Review and manage category budgets | Route observed; behavior documented |
| `/money/insights` | Income and spending analysis | Explore trends and category/account breakdowns | Route observed; behavior documented |
| `/essentials` | Financial essentials check | Review insurance, emergency fund, and savings measures | Route observed; details documented |
| `/accounts` | Financial account management | Create, organize, and select accounts | Route observed through release notes and dashboard |
| `/snapshots` | Historical net worth snapshots | Create and compare snapshots | Route observed; workflow documented |
| `/import` | Import entry point | Upload statements, templates, or supported portfolio exports | Route observed; form inaccessible in this audit |
| `/calculators` | Calculator directory | Navigate to individual calculators | Public page inspected |
| `/calculators/xirr` | Investment return analysis | Enter dated or periodic cash flows and estimate annualized returns | Public page inspected |
| `/calculators/sip` | Periodic investment projection | Enter monthly amount, return, duration, and optional step-up | Public page inspected |
| `/calculators/lumpsum` | One-time investment projection | Enter amount, return, and period | Public page inspected |
| `/calculators/cagr` | Annualized growth calculation | Enter initial value, final value, and period | Public page inspected |
| `/calculators/emi` | Loan repayment estimate | Enter loan amount, rate, and tenure | Public page inspected |
| `/calculators/fd` | Fixed-deposit projection | Enter amount, rate, tenure, and compounding frequency | Public page inspected |
| `/settings` | Account and application configuration | Preferences, data controls, profile management, billing | Route observed; authenticated content unavailable |
| `/settings?tab=plan&coupon=OCT15` | Plan upgrade entry point | View or upgrade plan with a promotional code | Route observed; checkout untested |
| `/whats-new` | Release notes and feature history | Review product changes and fixes | Public page inspected |
| `/privacy` | Privacy policy | Review data handling and security disclosures | Public page inspected |
| `/terms` | Terms of service | Review service terms, plans, and cancellation rules | Public page inspected |
| `/refund-policy` | Refund and cancellation policy | Review eligibility and support process | Public page inspected |

Public page evidence: <Cite refs={["turn998659view0","turn687444view0","turn998659view1","turn165366view0","turn998659view3","turn998659view4","turn165366view4","turn165366view5","turn165366view6","turn165366view7","turn165366view1","turn165366view2","turn165366view3"]}/>

### 3.3 Navigation relationships

A developer building an equivalent application should model the following relationships.

<CodeBlock language="mermaid" editable={false}>
flowchart TD
    A[Overview / Dashboard] --> B[Wealth]
    A --> C[Money]
    A --> D[Essentials]
    A --> E[Snapshots]
    A --> F[Import]
    A --> G[Calculators]
    A --> H[Settings]
    B --> B1[Assets]
    B --> B2[Liabilities]
    B --> B3[Accounts]
    B --> B4[Allocation]
    C --> C1[Transactions]
    C --> C2[Budget]
    C --> C3[Insights]
    C --> C4[Money Settings]
    H --> H1[Preferences]
    H --> H2[Profiles]
    H --> H3[Billing and Plan]
    H --> H4[Data Export and Deletion]
</CodeBlock>

The page groupings and some destinations are documented by the product's release notes. The exact sidebar expansion behavior and current tab structure require authenticated inspection. <Cite refs={["turn998659view1","turn165366view2"]}/>

---

## 4. Detailed Feature Specifications

This section translates the inventory into a practical build specification. Inputs and outputs explicitly described in official documentation are distinguished from implementation recommendations.

### 4.1 Net worth and overview dashboard

<row align=start gap={3}>
  <AsyncImage query="personal finance dashboard net worth balance sheet assets liabilities monthly cash flow card chart web application" aspectRatio="4:5" maxWidth="140px"/>
  <box flex="1" gap={1}>
    **Purpose:** Give users a single summary of their financial position and current activity.

    **Location:** `/dashboard`

    **Priority:** P0

    **Complexity:** High
  </box>
</row>

**Observed components**

- Net worth heading and selected currency.
- Privacy-redacted monetary values.
- A link to create a snapshot.
- Quick-add links for expense, asset, snapshot, and import.
- Monthly income/expense summary and add-income/add-expense links.
- Budget and insights shortcuts.
- Recent activity section with an empty-state message.
- Asset and liability counts and summaries.
- Investment change indicator.
- Goal count, change indicator, and off-track count.

**Expected business logic**

A comparable implementation should calculate:

\[
\text{Net Worth}=\text{Total Assets}-\text{Total Liabilities}
\]

For a multi-currency portfolio, values should be converted into a chosen base currency before aggregation. This is a necessary design implication of the advertised multi-currency functionality, not a claim that every exchange-rate edge case was tested.

**Inputs:** Saved assets, liabilities, transactions, selected currency, and any applicable filters or profile selection.

**Outputs:** Financial totals, activity summaries, trend indicators, and links to more detailed pages.

**Workflow**

1. Load the current user's financial records.
2. Calculate aggregate assets and liabilities.
3. Convert relevant values to the display currency.
4. Compute net worth and the relevant period summaries.
5. Render cards and navigation shortcuts.
6. Apply the privacy display preference to monetary values.
7. Allow the user to navigate into a detailed record list or create a new record.

**Dependencies:** Asset register, liability register, accounts, transaction engine, currency conversion, snapshots, goals, and profile management.

**Validation and edge cases to support:** No records, missing valuations, mixed currencies, negative net worth, closed loans, deleted records, stale FX rates, and profiles with different base currencies.

The exact rules behind the dashboard's investment percentage, change indicators, and goal status have not been established. They must be verified before reproducing those calculations.

### 4.2 Asset management

**Purpose:** Store a consolidated register of investments and other property.

**Locations:** `/assets`, `/assets/new`, asset-class-filtered routes.

**Priority:** P0. **Complexity:** Very High.

**Documented capabilities**

- Support for Indian investment types, including stocks, mutual funds, real estate, gold, EPF, PPF, NPS, SSY, SGBs, ULIPs, fixed deposits, and crypto.
- Asset-class filters.
- Search across asset tags.
- Asset values, invested amounts, and allocation percentages.
- Multi-currency holdings.
- Live price refresh for eligible assets on Pro.
- Geographic and tagging metadata.
- Investments split across allocation types, such as mixed equity/debt holdings.
- Maturity labels and notifications for supported deposits and bonds.

<Cite refs={["turn998659view0","turn998659view1"]}/>

**Inputs:** Asset name, class, value, currency, and any additional asset-specific information. Quantity, invested amount, geography, tags, and maturity information are supported or documented for relevant asset types.

**Outputs:** Asset register rows, class totals, allocation percentages, and values used by net worth and goal calculations.

**Implementation workflow**

1. Open the asset register.
2. Search or filter existing holdings.
3. Select Add Asset to open the creation form.
4. Enter the required details and any applicable optional metadata.
5. Validate required fields and numeric values.
6. Save the record and update the register and aggregate totals.
7. Allow subsequent editing or deletion.
8. If supported for the instrument, refresh the market price and recompute valuation.

Steps 2–8 are a proposed implementation sequence consistent with documented functionality; the exact FinBoom form controls and save feedback were not directly tested.

**Rules and dependencies**

- An asset may contribute to more than one allocation bucket when its investment composition is split.
- Account balances excluded from investment allocation may still contribute to net worth.
- Currency conversion must precede comparable-value sorting.
- Investment instrument identity must remain stable across re-imports.
- Asset deletion should reconcile downstream totals and snapshots according to an explicit product policy.

**Unverified:** The full list of required fields by asset class, supported manual valuation modes, validation messages, and deletion confirmation behavior.

### 4.3 Liabilities and loan management

**Purpose:** Track outstanding debt and model repayment progress.

**Location:** `/liabilities`, with loan-specific detail views documented in release notes.

**Priority:** P1. **Complexity:** High.

**Documented capabilities**

- Education, home, personal, vehicle, gold, business, and friends/family loans.
- Loan metadata such as lender, collateral, principal, due date, and account number.
- Loan filtering and sorting.
- Loan amortization schedules.
- Prepayment scenarios.
- Repayment history with principal and interest breakdown.
- EMI automation linked to recurring templates and payment accounts.
- Loan closure and outstanding balance tracking.

**Inputs:** Loan principal, interest rate, tenure, loan type, lender, repayment schedule, and applicable account details.

**Outputs:** Outstanding liability, payment history, EMI estimates, principal/interest allocation, and projected debt-free date.

**Dependencies:** Transaction records, recurring templates, account management, and the calculator engine.

**Important business rule:** A repayment that reduces principal must update the outstanding balance without incorrectly restoring the original principal. Product release notes explicitly document a past bug in this area. <Cite refs={["turn998659view1","turn687444search1"]}/>

**Unverified:** Whether every loan type shares the same form, whether interest rates can vary over time, and the exact accounting behavior for early settlement.

### 4.4 Transactions: income, expenses, and transfers

**Purpose:** Provide a unified ledger for day-to-day money movements.

**Location:** `/transactions`, with `/expenses/new` as a shortcut for expense entry.

**Priority:** P0. **Complexity:** High.

**Documented features**

- A unified transaction page for expenses, income, and transfers.
- Monthly totals and month-grouped records.
- Period filters.
- Category and tag support.
- Bulk recategorization.
- Cloning existing transactions.
- Selection of multiple records and a combined running total.
- Cross-currency transfers.
- Custom income and expense categories.
- Arithmetic expressions inside amount inputs.
- Category rules that can be saved when correcting a transaction.

**Inputs:** Transaction type, amount, currency/account, date, category, description or note, and optional tags.

**Outputs:** Updated transaction list, monthly summaries, category totals, insights, and budget consumption.

**Workflow**

1. Open Transactions or use a quick-add shortcut.
2. Select the transaction type.
3. Enter the amount, date, account, and category.
4. Enter any optional note or tags.
5. Save the record.
6. Review the new entry in the list.
7. Filter or select records for editing, cloning, recategorization, or analysis.

This is an implementation specification based on advertised and documented behavior, not a live-tested sequence.

**Business rules**

- Account currency should determine or inform the transaction currency.
- Transfers must not be counted as ordinary income or spending in cash-flow analysis.
- Cross-currency transfers require amounts and currency treatment on both sides.
- Bulk actions must apply only to selected records.
- Category changes can optionally create rules for future transactions.
- A transaction must not be double-counted in monthly trends.

The release history confirms fixes for multi-currency entries, transfer imports, investment double-counting, and category selection on mobile. <Cite refs={["turn998659view1","turn687444search1"]}/>

### 4.5 Accounts and account organization

**Purpose:** Represent the financial accounts associated with transactions and balances.

**Location:** `/accounts`, under the Money module.

**Priority:** P1. **Complexity:** Medium–High.

**Documented capabilities**

- Assign imported transactions to an account.
- Link recurring templates to accounts.
- Reorder accounts using drag-and-drop, then save the order.
- Exclude selected accounts from investment allocation without removing them from net worth.
- Filter transactions by account.
- Support transfers between accounts and currencies.

**Inputs:** Account name and currency, plus whatever account metadata the creation form requires.

**Outputs:** An ordered account list, account-specific transaction views, and balances that feed the broader financial summary.

**Dependencies:** Transactions, imports, currency handling, allocation, and recurring templates.

**Unverified:** Full account types, opening-balance treatment, reconciliation features, and the exact account deletion rules.

### 4.6 Budget management

**Purpose:** Set spending limits and identify overspending.

**Location:** `/budget`.

**Priority:** P1. **Complexity:** Medium–High.

**Documented capabilities**

- Category-level budget configuration.
- Budget-exempt categories.
- Customization of categories through Money Settings.
- Alerts at 80% of a category budget and when a budget is exceeded.
- A reminder on the 15th of the month for categories spending quickly.
- Clearing an existing budget by saving an empty plan.

**Inputs:** Budget period, category limits, and any exclusion settings.

**Outputs:** Budget consumption, category-level status, and alerts.

**Recommended calculation**

\[
\text{Budget Usage}=\frac{\text{Eligible Spending}}{\text{Budget Limit}}\times100\%
\]

The formula is a standard implementation approach; the precise treatment of refunds, transfers, and date boundaries needs testing against the application.

**Dependencies:** Transaction classification, category rules, recurring transactions, and notifications.

**Edge cases:** Zero budget, overspending, missing categories, refunds, transfers, month rollover, and changing a category's exclusion status after transactions already exist.

### 4.7 Money insights

**Purpose:** Explain cash flow and spending patterns beyond a simple ledger.

**Location:** `/money/insights`.

**Priority:** P1. **Complexity:** High.

**Documented capabilities**

- Monthly income/expense trends.
- Category-level spending breakdowns.
- Recurring-spending analysis.
- Savings-rate indicators.
- Account filters.
- Bulk selection of categories or tags.
- Corrected chart logic to prevent investment transactions from being counted twice.

**Inputs:** Date range or period, account selection, and category/tag filters where available.

**Outputs:** Summary metrics, trend charts, category breakdowns, and spending insights.

**Recommended dependency design:** A shared transaction aggregation service should feed the dashboard, budget, and insights modules. This reduces the risk of the same transaction producing different totals in different parts of the application.

**Unverified:** Exact chart types, drill-down behavior, export options, and the formulas used for savings rate and recurring monthly run rate.

### 4.8 Financial essentials

**Purpose:** Help users monitor whether key financial safeguards are in place.

**Location:** `/essentials`.

**Priority:** P1. **Complexity:** Medium–High.

**Documented capabilities**

- Term insurance coverage.
- Health insurance coverage.
- Emergency fund tracking.
- Monthly income and expenses.
- Savings-related indicators.
- Debt ratio and financial health score.
- Recommendations based on a user's financial profile.
- Profile-specific essentials for Pro users.

**Inputs:** Insurance cover, income, expenses, emergency savings, and relevant profile information.

**Outputs:** Coverage indicators, emergency-fund progress, savings measures, and financial health feedback.

**Example implementation formulas**

\[
\text{Savings}=\text{Monthly Income}-\text{Monthly Expenses}
\]

\[
\text{Savings Rate}=\frac{\text{Savings}}{\text{Monthly Income}}\times100\%
\]

These are conventional candidate formulas, not confirmed formulas for all FinBoom indicators.

**Validation:** Prevent invalid negative coverage values and handle zero income without division errors. Display the assumptions behind any recommendations.

**Unverified:** The complete scoring model, thresholds for adequate insurance, and the exact definition of debt ratio.

### 4.9 Goals and financial targets

**Purpose:** Turn long-term objectives into trackable financial targets.

**Location:** Dashboard goal summary; the exact goal-management route was not established in the supplied content.

**Priority:** P1. **Complexity:** High.

**Documented capabilities**

- Create goals such as retirement and education funding.
- Link assets to goals.
- Show goal progress.
- Identify off-track goals.
- Account for inflation in target planning.
- Support multiple goals and profile-specific goals.

**Inputs:** Goal name, target amount, target date, inflation assumptions, and linked assets where applicable.

**Outputs:** Progress percentage, projected funding position, and on-track/off-track status.

**Recommended implementation sequence**

1. Create a goal with target and deadline.
2. Configure any inflation assumptions.
3. Link eligible assets.
4. Calculate progress using the selected goal methodology.
5. Display status and allow the user to update the goal.

**Unverified:** Whether linked assets are allocated exclusively to a single goal or may contribute to several goals, how overlapping goals are reconciled, and how status thresholds are calculated.

### 4.10 Net worth snapshots

**Purpose:** Preserve financial history for comparison.

**Location:** `/snapshots`, with dashboard shortcut.

**Priority:** P1. **Complexity:** Medium–High.

**Documented capabilities**

- Manually create a snapshot.
- Compare historical financial positions.
- Display month-over-month growth and detailed line items.
- Schedule automatic snapshots at weekly, biweekly, or monthly intervals for Pro users.

**Inputs:** Current financial data and, where scheduling is available, a snapshot frequency.

**Outputs:** A timestamped financial record and comparison data.

**Implementation considerations**

A snapshot should preserve a historical state rather than simply point at mutable current records. Otherwise, editing an old asset could inadvertently change historical reporting.

The exact snapshot schema, historical FX treatment, and whether automatic snapshots include every profile were not verified.

### 4.11 Import engine

**Purpose:** Reduce manual data entry by translating external financial exports into application records.

**Location:** `/import`.

**Priority:** P1. **Complexity:** Very High.

**Documented import families**

- General CSV data.
- CSV/Excel templates.
- Zerodha, Groww, Upstox, Angel One, ICICI Direct, mstock, 5paisa, and Dhan investment exports.
- MFCentral consolidated mutual fund statements.
- Vested and Tickertape exports.
- Supported bank statements, including specified HDFC, IDFC FIRST, Kotak, ABN Amro, Revolut, and Trade Republic formats.

These are documented examples, not a guarantee that every version of every provider's export is supported. <Cite refs={["turn998659view1","turn687444search1"]}/>

**Inputs:** A supported file, and optionally an account selection, statement password, or category corrections.

**Expected outputs:** Parsed assets or transactions, suggested categories, account associations, and a reviewable import result.

**Recommended workflow**

1. Choose the import source or file type.
2. Select the file.
3. Parse and validate its format.
4. Preview detected records.
5. Identify likely duplicates.
6. Assign accounts and correct categories.
7. Resolve errors or unsupported rows.
8. Confirm import.
9. Display a result summary and refresh affected records.

**Critical business rules**

- Do not silently discard transactions merely because another account has a similar record.
- Preserve manually corrected categories when rules are applicable.
- Keep investment instrument identity stable during re-import.
- Treat transfers separately from income and expenses.
- Handle locked files and malformed inputs with actionable errors.
- Make the final commit idempotent where possible, so repeated submissions do not create duplicate records.

The workflow above is the recommended architecture based on documented import features; the actual screen-by-screen review and error handling remain untested.

### 4.12 Financial calculators

The calculator directory is one of the strongest publicly inspectable parts of the website. It explicitly says calculations run in the browser and entered values are not saved or sent anywhere. <Cite refs={["turn165366view0","turn165366view4"]}/>

<box gap={3}>
  <row align=start gap={3}>
    <AsyncImage query="financial investment XIRR calculator form annualized return results interface" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **XIRR calculator** — `/calculators/xirr`

      <text color="secondary" size="sm">Priority P2 · Medium complexity</text>

      Inputs include currency, a SIP or custom cash-flow mode, investment amounts, investment dates or duration, and current value as applicable. Outputs include annualized return, invested amount, gain, and absolute return.

      The page distinguishes irregular cash flows from a single lump-sum investment. <Cite refs={["turn998659view4"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="SIP mutual fund investment calculator monthly investment annual return step up projected value interface" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **SIP calculator** — `/calculators/sip`

      <text color="secondary" size="sm">Priority P2 · Medium complexity</text>

      Inputs include monthly contribution, expected annual return, duration, duration unit, currency, and optional annual step-up. Outputs include projected value, total invested, and estimated returns.

      The documented calculation assumes monthly compounding and contributions at the start of each month. <Cite refs={["turn998659view3"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="lump sum investment future value calculator financial planning form" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **Lumpsum calculator** — `/calculators/lumpsum`

      <text color="secondary" size="sm">Priority P2 · Low–Medium complexity</text>

      Inputs: one-time investment, expected return, and investment period. Outputs: projected value, original investment, and estimated returns.

      The documented model compounds annually at a constant assumed return. <Cite refs={["turn165366view5"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="CAGR calculator initial value final value annual growth rate finance web form" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **CAGR calculator** — `/calculators/cagr`

      <text color="secondary" size="sm">Priority P2 · Low complexity</text>

      Inputs: initial value, final value, period, and currency. Outputs: compound annual growth rate and total growth.

      Standard calculation: \(\text{CAGR}=(\text{Final}/\text{Initial})^{1/t}-1\), where \(t\) is the duration in years. The actual page exposes a years/months choice. <Cite refs={["turn165366view6"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="loan EMI calculator principal interest tenure monthly payment results chart" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **EMI calculator** — `/calculators/emi`

      <text color="secondary" size="sm">Priority P2 · Medium complexity</text>

      Inputs: loan amount, annual interest rate, tenure, currency, and years/months unit. Outputs: monthly EMI, principal, total interest, and total payment.

      The public page specifies the standard reducing-balance formula with monthly compounding. <Cite refs={["turn165366view4"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="fixed deposit FD maturity calculator principal interest rate compounding frequency results" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **Fixed-deposit calculator** — `/calculators/fd`

      <text color="secondary" size="sm">Priority P2 · Medium complexity</text>

      Inputs: deposit amount, interest rate, tenure, currency, duration unit, and compounding frequency. Outputs: maturity value, original deposit, and interest earned.

      The documented calculation assumes the chosen rate remains constant for the full period. <Cite refs={["turn165366view7"]}/>
    </box>
  </row>
</box>

**Additional observations**

- The calculator directory marks a systematic withdrawal plan (SWP) with inflation and a retirement calculator as “Soon.” These should be classified as announced or planned, not as available functionality. <Cite refs={["turn165366view0"]}/>
- The calculator pages include explanatory content, FAQs, related-calculator links, and financial disclaimers.
- The XIRR, SIP, EMI, and CAGR pages should be tested for zero values, negative cash flows, invalid durations, missing fields, and extreme inputs before being treated as production-ready equivalents.

### 4.13 Settings, privacy, and subscriptions

**Purpose:** Manage account access, personal preferences, data portability, and paid access.

**Location:** `/settings` and related settings tabs.

**Priority:** P1. **Complexity:** High.

**Documented capabilities**

- Google OAuth and email/password authentication.
- Password recovery and email verification.
- App lock using a PIN.
- Text-size controls.
- Profile and base-currency configuration.
- Shared access and multi-profile functionality on Pro.
- Notification preferences.
- Data export to CSV or JSON.
- Account deletion.
- Pro upgrade and cancellation.
- Feedback submission and app installation.

The privacy policy also states that the product does not connect to financial institutions, and that the app uses a session cookie for authentication. <Cite refs={["turn165366view1","turn165366view2"]}/>

**Recommended account-deletion workflow**

1. Open Settings and find the data or Danger Zone section.
2. Export important data first.
3. Review the deletion warning.
4. Confirm the irreversible action.
5. Invalidate active sessions and remove the account's associated data according to the product's deletion policy.
6. Present a clear completion state.

The policy documents permanent deletion as a feature; this audit did not perform it.

**Subscription rules documented in the current terms**

- Free tier: up to 25 assets, 5 liabilities, 3 goals, and 2 snapshots per month.
- Pro six-month plan: ₹599.
- Pro yearly plan: ₹749.
- Pro lifetime offer: ₹3,499, subject to the stated offer period and availability.
- Existing data remains available after downgrading, even when records exceed free-tier limits.
- Pro features remain active until the applicable paid period ends after cancellation.
- The refund policy states a seven-day refund window for Pro purchases.

<Cite refs={["turn165366view2","turn165366view3"]}/>

These are published terms, not checkout-tested results. The site's promotional offer may change; current purchase terms should be checked at the point of payment.

---

## 5. User Journey Documentation

The journeys below distinguish publicly documented workflows from sequences that still need direct application testing.

### 5.1 First-time onboarding and dashboard setup

<badge color="success">Documented journey</badge>

1. Open the landing page.
2. Choose Get Started Free.
3. Register using Google or email/password.
4. Complete the requested profile setup and any email-verification step.
5. Add an asset manually or use a supported import.
6. Review the dashboard's net worth, asset allocation, and financial summaries.
7. Add liabilities, transactions, goals, or essentials information as needed.

**Expected result:** The dashboard reflects the financial data entered by the user.

**Edge cases to test:** Interrupted email verification, duplicate registration, invalid credentials, empty portfolios, and a user who starts onboarding but does not finish. The release notes document saving onboarding answers when email verification interrupts signup. <Cite refs={["turn998659view0","turn998659view1"]}/>

### 5.2 Add and maintain an asset

<badge>Workflow to verify in app</badge>

1. Open Wealth.
2. Select the asset creation action.
3. Choose or enter an asset category.
4. Provide required details and valuation.
5. Select currency and optional metadata where applicable.
6. Save the record.
7. Confirm that the asset appears in the list and dashboard totals.
8. Reopen it to edit or delete it.

**Expected result:** A valid asset contributes to the relevant asset-class total and net worth.

**Important tests:** Missing names, invalid amounts, currency conversion, asset edits after a snapshot, multi-category allocations, and the deletion/undo flow.

### 5.3 Import a bank statement

<badge>Documented capabilities; exact UI untested</badge>

1. Open Import.
2. Choose a supported statement format.
3. Upload the file and provide any required password.
4. Select the destination account if the importer offers that option.
5. Review parsed transactions and duplicate warnings.
6. Correct categories or apply category rules.
7. Resolve unsupported or invalid rows.
8. Confirm the import.
9. Check that the imported records appear in Transactions.

**Expected result:** Valid records become transactions associated with the selected account.

**Edge cases:** Encrypted PDFs, incorrect passwords, malformed CSVs, mixed currencies, duplicate imports, transfers, and partial import failures.

### 5.4 Correct a category and save a rule

<badge color="success">Documented workflow</badge>

1. Find a transaction with an incorrect category.
2. Edit its category.
3. Choose the option to save the correction as a rule.
4. Specify the merchant or text match if required.
5. Save the rule.
6. Import a future statement or apply the rule to existing transactions.
7. Verify that matching records receive the intended category.

The release notes describe rules based on text such as a merchant name, with limits of 25 rules for Free and 500 for Pro. Rule editing is also documented. <Cite refs={["turn998659view1"]}/>

**Important tests:** Case sensitivity, partial matches, conflicting rules, overlapping merchants, and a category that changes after a rule has been created.

### 5.5 Create a budget and respond to alerts

<badge color="success">Documented capabilities</badge>

1. Open Budget.
2. Configure a category spending limit.
3. Record or import eligible expenses.
4. Monitor category usage.
5. Receive an alert at 80% consumption.
6. Receive an over-budget alert if spending exceeds the limit.
7. Review the mid-month reminder if a category is spending quickly.
8. Adjust the budget or review the transactions.

The 80% alert, over-budget alert, and mid-month reminder are documented in the release history. <Cite refs={["turn998659view1"]}/>

**Important tests:** Budget resets, exempt categories, refunds, transfers, late-arriving transactions, and whether alerts are sent once or repeatedly.

### 5.6 Create and compare a snapshot

<badge>Workflow to verify in app</badge>

1. Open Snapshots from the dashboard or navigation.
2. Choose the manual snapshot action.
3. Confirm the financial state being captured.
4. Save the snapshot.
5. Open a previous snapshot.
6. Compare values and line items.
7. If enabled, configure automatic snapshot frequency.

**Expected result:** A historical financial position that can be compared with a later one.

**Important tests:** Whether snapshots preserve historical currency conversion, what happens after deleting an asset, and whether automatic captures can be duplicated.

### 5.7 Calculate a financial projection

<badge color="success">Public form structure documented</badge>

1. Open the calculator directory.
2. Select a calculator.
3. Enter the amount and rate inputs.
4. Choose the duration and its unit.
5. Adjust optional inputs, such as SIP step-up or FD compounding frequency.
6. Review the projected output.
7. Change an input and confirm the result recalculates.
8. Use the result for planning, recognizing that it depends on assumptions.

**Expected result:** A calculated projection or return estimate displayed in the browser.

**Privacy behavior:** The public calculator directory states that calculations run locally in the browser and the entered values are not saved or sent anywhere. This claim was documented on the public page, not independently verified with network inspection. <Cite refs={["turn165366view0","turn998659view3","turn165366view4"]}/>

### 5.8 Upgrade, cancel, export, or delete

<badge>Policy documented; execution untested</badge>

**Upgrade**

1. Open the Pro upgrade link or Settings → Plan.
2. Review available plans and current pricing.
3. Apply a promotion if eligible.
4. Complete the payment flow.
5. Confirm that the account reflects the new entitlement.

**Cancel**

1. Open Settings.
2. Locate the plan or billing section.
3. Initiate cancellation.
4. Confirm the applicable end date and retained access.

**Export**

1. Open Settings.
2. Find the data export function.
3. Choose CSV or JSON where offered.
4. Download the data and verify its completeness.

**Delete**

1. Export data if needed.
2. Review subscription implications.
3. Open the Danger Zone.
4. Confirm permanent deletion.

The last three workflows are based on published policy, not observed clicks. In particular, the actual payment provider, export screen, and deletion confirmation UX remain unverified. <Cite refs={["turn165366view1","turn165366view2","turn165366view3"]}/>

---

## 6. UI/UX Analysis

### 6.1 Design language and information hierarchy

The supplied dashboard and public pages suggest a finance-oriented interface built around summary cards, compact metrics, tables or lists, and direct navigation to detailed views.

<box gap={2}>
  <row align=start gap={3}>
    <AsyncImage query="minimal modern finance dashboard card grid net worth dark navy white interface" aspectRatio="4:3" maxWidth="124px"/>
    <box flex="1" gap={1}>
      **Summary-first design**

      Major financial totals appear before detailed records. This is appropriate for a personal finance product because users often want their net worth and current-month position before inspecting individual transactions.
    </box>
  </row>
  <row align=start gap={3}>
    <AsyncImage query="personal finance app asset allocation donut chart compact metric cards" aspectRatio="4:3" maxWidth="124px"/>
    <box flex="1" gap={1}>
      **Progressive disclosure**

      The overview presents counts, categories, and summary values, then links to full asset, liability, or transaction views. This avoids placing every record on the dashboard.
    </box>
  </row>
  <row align=start gap={3}>
    <AsyncImage query="accessible financial application transaction list filters compact rows mobile responsive interface" aspectRatio="4:3" maxWidth="124px"/>
    <box flex="1" gap={1}>
      **Action-oriented navigation**

      Quick-add links, contextual links, and module-specific actions reduce the number of steps required for common tasks.
    </box>
  </row>
</box>

These images are illustrative design references, not screenshots of FinBoom. Exact font families, color values, spacing tokens, and the full desktop/mobile layouts have not been measured.

### 6.2 Reusable components worth implementing

| Component | Recommended behavior |
|---|---|
| Financial metric card | Label, formatted value, optional change indicator, click-through |
| Quick-add action | Clear entry point into a specific creation workflow |
| Empty state | Explain why no data appears and offer a relevant next action |
| Search/filter toolbar | Search, category, date, account, and sort controls as applicable |
| Financial record row | Name, category, amount, metadata, and contextual actions |
| Privacy toggle | Redact financial values consistently across the application |
| Progress indicator | Display goal or budget progress with a textual status |
| Allocation visualization | Show investment proportions and associated values |
| Modal/form | Validate inputs and preserve entered values when changing form modes |
| Notification item | Explain the event and link to the relevant record |
| Upgrade prompt | Present plan limits and a direct path to plan details |
| Undo feedback | Allow recovery from supported deletion actions |
| Calculator result panel | Display calculated output alongside assumptions and input controls |

### 6.3 Tables, charts, and data density

Product release notes describe a dense asset table, month-grouped transactions, monthly trends, allocation visualizations, snapshot comparisons, and charts with compact summary cards. They also document mobile-specific improvements to holdings tables and category selection. <Cite refs={["turn998659view1"]}/>

For a comparable implementation:

- Use full amounts in detailed transaction rows; reserve abbreviated numbers for compact cards when needed.
- Keep sorting and filtering close to the list they affect.
- Distinguish asset allocation from account balances.
- Make chart legends and category colors understandable without relying on color alone.
- Use accessible text labels and keyboard-operable controls.
- Provide a card-based or otherwise responsive layout on small screens.
- Preserve filter and tab state when navigating back or refreshing, where appropriate.

These are implementation recommendations, not assertions that every behavior is currently present.

### 6.4 Forms, feedback, and error states

The public release history provides evidence that FinBoom has addressed:

- Category selection on mobile.
- Preservation of form values when switching to bulk entry.
- Validation errors in financial essentials.
- App-lock setup reliability.
- Duplicate detection during imports.
- Undo for deletion across supported record types.

<Cite refs={["turn998659view1"]}/>

A comparable product should also define explicit states for:

- Initial loading and data refresh.
- No records yet.
- Search returned no matches.
- Invalid or incomplete input.
- Failed imports and partial success.
- Network or server errors.
- Save success and undo availability.
- Subscription-required actions.
- Expired sessions and authentication errors.

The actual wording and appearance of most of FinBoom's feedback states were not directly observed.

### 6.5 Responsive and accessibility considerations

The release history documents a mobile category picker with larger tap targets, a holdings table that fits phone screens, a mobile card view for recurring templates, and a text-size preference. Tablet rotation is also mentioned. <Cite refs={["turn998659view1"]}/>

**Confirmed:** Responsive improvements and adjustable text size are documented.

**Not verified:** Exact breakpoints, keyboard navigation, screen-reader announcements, color contrast, focus order, and full accessibility compliance.

For a new implementation, these should be explicit acceptance criteria rather than assumptions based on visual similarity.

---

## 7. Technical Observations

### 7.1 Confirmed or publicly documented architecture clues

| Area | Observation | Confidence |
|---|---|---|
| Hosting and HTTPS | Privacy policy says HTTPS is enforced and describes a hosting provider, but does not name it | Documented |
| Database | Privacy policy identifies PostgreSQL on AWS infrastructure | Documented |
| Access control | Row-level security is described as enforcing user isolation | Documented |
| Authentication | Google OAuth and email/password authentication are documented | Documented |
| Session management | Signed, expiring session tokens and a session cookie are described | Documented |
| Password storage | Passwords are described as securely hashed | Documented |
| FX rates | A third-party FX rate provider is used, but its name is not disclosed on the policy page | Documented |
| Payments | A payment processor handles payment data; provider identity is unverified | Documented |
| Data export | CSV and JSON exports are advertised | Documented |
| Calculator computation | Public calculator pages state that calculations run in the browser | Documented |
| Bank connectivity | The product says it does not connect directly to banks or brokerages | Documented |
| Analytics | The policy describes anonymous page-view analytics and says third-party trackers are not used | Documented |

Sources: <Cite refs={["turn165366view1","turn165366view2","turn165366view0"]}/>

### 7.2 Navigation and routing

The observable site uses conventional URL paths and query parameters, for example:

- `/dashboard`
- `/assets?class=EQUITY`
- `/settings?tab=plan&coupon=OCT15`
- `/login?callbackUrl=/dashboard`

The login redirect suggests protected routes require authentication and may preserve a requested destination through a callback parameter. This is an observation about navigation behavior, not proof of the underlying framework or complete authorization implementation.

### 7.3 Import and asynchronous behavior

Documented features imply several background or asynchronous operations:

- File parsing and record validation.
- Import review and duplicate detection.
- Exchange-rate retrieval.
- Market-price refresh.
- Scheduled recurring transaction generation.
- Automatic snapshots.
- Email and in-app notifications.

The exact job scheduler, queue technology, retry policy, API design, and background worker architecture are not visible from the available evidence.

### 7.4 Framework and library indicators

No framework or charting library can be reliably identified from the public page text alone. The evidence does not justify claiming that FinBoom uses React, Next.js, Supabase, a particular charting library, or a particular payment gateway.

The privacy policy names PostgreSQL and AWS-hosted infrastructure; it does **not** independently establish the use of Supabase. Where another marketing statement mentions a hosting/database arrangement, that statement should not be treated as source-code verification.

### 7.5 Privacy and data-handling design

The documented design favors explicit user control:

- Manual data entry and statement imports rather than direct account linking.
- Financial data export.
- Account deletion.
- User-level data isolation.
- Local calculations for public calculators.
- No use of user financial data for AI training, according to the privacy policy.

<Cite refs={["turn165366view1","turn165366view2"]}/>

For a comparable product, data isolation, encryption, auditability of destructive actions, and export completeness should be treated as core architectural requirements, not optional UI enhancements.

---

## 8. Feature Prioritization

The priorities below are recommended for building a comparable application. They reflect user value, dependencies, and implementation effort—not FinBoom's internal engineering priorities.

### 8.1 Priority definitions

| Priority | Meaning | Build strategy |
|---|---|---|
| P0 — Core | Required for the product's main purpose | Implement and validate first |
| P1 — High value | Makes the product substantially more useful | Build after the core data flows work |
| P2 — Enhancement | Improves convenience, analysis, or usability | Add after core workflows stabilize |
| P3 — Advanced/optional | Specialized, expensive, or lower-frequency functionality | Add based on demand and available resources |

### 8.2 Prioritized implementation roadmap

<text color="secondary" size="sm">Complexity estimates assume a production-quality application with authentication, persistent data, validation, and automated tests.</text>

| Feature | Priority | Complexity | Main dependencies |
|---|---|---|---|
| Authentication and account isolation | P0 | High | Identity provider, sessions, authorization |
| Asset register and valuation | P0 | Very High | Database, asset categories, currencies |
| Liabilities and net worth calculations | P0 | High | Asset and liability records |
| Unified income/expense/transfer ledger | P0 | High | Accounts, categories, transaction rules |
| Overview dashboard | P0 | High | All core financial modules |
| Manual add/edit/delete flows | P0 | Medium–High | Forms, validation, persistence |
| Currency selection and conversion | P0 | High | FX data source, rounding, stale-rate handling |
| Privacy toggle for financial values | P0 | Low–Medium | Shared display-state management |
| CSV import and data validation | P0 | High | Parser, mapping, duplicate detection |
| Data export | P0 | Medium | Export schema, permissions |
| Goal tracking | P1 | High | Asset valuations, target dates |
| Snapshots and historical comparison | P1 | High | Historical state preservation |
| Budget and category limits | P1 | Medium–High | Transaction aggregation |
| Money insights and trend charts | P1 | High | Consistent aggregation service |
| Financial essentials | P1 | Medium–High | User inputs, scoring rules |
| Account management | P1 | Medium–High | Transactions, currencies |
| Broker and bank-statement import adapters | P1 | Very High | Provider-specific parsers and fixtures |
| Recurring income and expense templates | P1 | High | Scheduler, transactions, idempotency |
| Loan repayment and amortization | P1 | High | Loan model, interest calculations |
| Notification system | P1 | High | Events, scheduler, email delivery |
| Category rules and bulk recategorization | P1 | Medium–High | Matching rules, conflict resolution |
| Family/business profiles | P1 | Very High | Authorization, profile isolation, aggregation |
| Shared access | P2 | Very High | Permissions, invitations, auditing |
| Live market-price refresh | P2 | Very High | Pricing providers, instrument mapping |
| Investment performance analytics | P2 | High | Valuation history, cash-flow analysis |
| Financial calculators | P2 | Medium | Financial formulas, input validation |
| Transaction cloning and running totals | P2 | Low–Medium | Transaction list and selection |
| Installable app experience | P2 | Medium | Manifest, icons, platform behavior |
| App lock with PIN | P2 | Medium–High | Secure local state, lifecycle handling |
| Advanced allocation targets | P2 | High | Asset classifications, profile rules |
| Automated snapshots | P2 | High | Scheduling and historical storage |
| Additional broker-specific formats | P2 | High per adapter | Fixtures, parsing and validation |
| Advanced retirement/SWP planning | P3 | High | Projection assumptions and calculators |
| Generative AI financial assistant | P3 | Very High | Not confirmed as a FinBoom feature; separate product decision |

### 8.3 Recommended build order

<box border radius="lg" padding={3} gap={3}>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="layers" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 1 — Financial foundation**

      Authentication, user isolation, currencies, assets, liabilities, accounts, transactions, and net worth calculations.

      <badge>P0</badge>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="layout-dashboard" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 2 — Core user experience**

      Dashboard, search and filters, forms, empty states, data export, and privacy controls.

      <badge>P0</badge>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="chart-no-axes-combined" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 3 — Planning and analysis**

      Snapshots, budgets, goals, insights, and financial essentials.

      <badge>P1</badge>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="file-up" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 4 — Automation and integrations**

      Import adapters, recurring templates, category rules, notifications, and loan automation.

      <badge>P1</badge>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="sparkles" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 5 — Advanced capabilities**

      Live pricing, shared profiles, advanced performance analysis, and specialized planning tools.

      <badge>P2–P3</badge>
    </box>
  </row>
</box>

**Key architectural recommendation:** Build a consistent financial data model and calculation layer before implementing advanced charts. Net worth, budgets, insights, goal progress, snapshots, and loan repayment all depend on the correctness of shared financial records.

---

## 9. Limitations and Unverified Features

### 9.1 Authentication and account restrictions

The dashboard URL redirected to a login page in the independent public-page inspection. The supplied authenticated dashboard content was still available as context, but there was no live authenticated browser session for further interaction.

I did not bypass authentication, access controls, or payment restrictions.

### 9.2 What remains unverified

| Area | What still needs inspection |
|---|---|
| Add menu | Every action, dropdown, modal, and available record type |
| Dashboard | Exact chart interactions, tooltips, period selectors, and card drill-downs |
| Assets | Full create/edit forms, field validation, deletion confirmation, sorting, and pagination |
| Liabilities | Every loan form, repayment controls, schedule editing, and closure workflow |
| Transactions | Exact filters, sort options, bulk-action menus, and pagination behavior |
| Accounts | Account creation, opening balances, reconciliation, and deletion rules |
| Budget | Full configuration UI, reset behavior, and alert settings |
| Insights | Chart interactions, export options, date controls, and formula definitions |
| Essentials | Exact scoring rules, thresholds, and recommendation calculations |
| Goals | Goal form, linking behavior, progress calculations, and goal-management route |
| Snapshots | Comparison interface, historical valuation rules, and automatic scheduling controls |
| Import | Full source selector, supported file formats in the live UI, error recovery, and import confirmation |
| Settings | Every tab, profile switcher, notification preference, and data-management control |
| Subscription | Checkout provider, payment confirmation, upgrade entitlements, and cancellation UI |
| Notifications | Notification center, read/unread state, and individual notification actions |
| Responsive behavior | Full authenticated mobile and tablet layouts |
| Accessibility | Keyboard navigation, screen-reader behavior, focus handling, and measured contrast |
| Loading and errors | Actual network failures, retry behavior, and error messages |
| AI functionality | No dedicated AI assistant was established by the available evidence |

### 9.3 Technical uncertainties

The following cannot be reliably established from the inspected page content:

- The frontend framework and exact component libraries.
- The complete backend architecture, database schema, and API contracts.
- The identity of the FX provider, payment processor, and hosting provider.
- The exact data retention and deletion behavior at every backend layer.
- The precise financial formulas for all dashboard metrics.
- Whether every documented feature is currently available to every account.
- The full inventory of responsive breakpoints and accessibility behaviors.

### 9.4 Documentation discrepancies

Public documentation can change at different times. In particular:

- Currency support counts differ across marketing copy and release history.
- The published pricing and feature entitlements should be verified at checkout before implementation.
- Some calculator tools are marked as upcoming rather than available.
- A release note establishes that a feature was announced or changed, not that every current account has it enabled.

The current public terms and refund policy agree on the advertised six-month, yearly, and lifetime prices, but the actual purchase flow was not tested. <Cite refs={["turn165366view2","turn165366view3","turn165366view0"]}/>

### 9.5 Inspection checklist

{@body const auditItems = [
{section:"Public pages",items:["Landing page and product positioning","Calculator directory and six calculator pages","Privacy policy, terms, and refund policy","What's New release history","Login and registration screen"]},
{section:"Authenticated application",items:["Dashboard and Add menu","Assets and asset creation","Liabilities and loan details","Transactions and bulk actions","Accounts and Money Settings","Budget and alerts","Money Insights","Essentials and goals","Snapshots and comparisons","Import and import review","Settings, profiles, and billing","Notifications and feedback"]},
{section:"Behavioral testing",items:["Form validation and save feedback","Search, sorting, and pagination","Loading, empty, and error states","Mobile layout and accessibility","Export, deletion, and undo behavior","Pro-gated functionality and entitlements"]}
]}
{@body const [checkedAudit,setCheckedAudit] = DIL.useState([])}
<box border radius="lg" padding={3} gap={3}>
  <row align="center" justify="between">
    <title size="md">Audit completion tracker</title>
    <text color="secondary" size="sm">{checkedAudit.length} / {auditItems.reduce((n,s)=>n+s.items.length,0)} marked</text>
  </row>
  <text color="secondary" size="sm">Mark items as you independently verify them. This checklist is for your own follow-up; it does not change the inspection evidence above.</text>
  {#each auditItems as section}
    <box gap={2} key={section.section}>
      <text weight="medium">{section.section}</text>
      {#each section.items as item}
        <checkbox key={item} checked={checkedAudit.includes(item)} onChange={v=>setCheckedAudit(old=>v?[...old,item]:old.filter(x=>x!==item))}>{item}</checkbox>
      {/each}
    </box>
  {/each}
  <button block variant="outline" onClick={() => GenUI.copy(auditItems.map(s=>s.section+"\n"+s.items.map(i=>(checkedAudit.includes(i)?"[x] ":"[ ] ")+i).join("\n")).join("\n\n"))}>Copy checklist</button>
</box>

---

## 10. Final Coverage Summary

### 10.1 Coverage accounting

These are counts of the audit's documented coverage, not counts of every screen or feature in the actual application.

| Measure | Result |
|---|---|
| Supplied authenticated dashboard | 1 inspected |
| Public landing page | 1 inspected |
| Authentication page | 1 inspected |
| Public calculator directory | 1 inspected |
| Individual public calculators | 6 inspected |
| Public legal/policy pages | 3 inspected |
| Public What's New page | 1 inspected |
| Additional authenticated route families identified | 12+ |
| Major feature modules documented | 12 |
| Individual feature entries | Dozens, grouped by module |
| User journeys documented | 8 |
| Live authenticated workflows tested | 0 |
| Dedicated AI assistant verified | 0 |
| Complete authenticated application coverage | Not achieved |

The page counts above describe the pages examined or identified in this report; they do not imply that all listed routes were independently accessible. Public calculator and policy content was inspectable, while authenticated routes could not be fully exercised.

### 10.2 Overall assessment

FinBoom is best understood as a personal financial management and wealth-tracking application with four major layers:

1. **Financial records:** assets, liabilities, accounts, transactions, and categories.
2. **Analysis and planning:** net worth, allocation, cash flow, budgets, goals, snapshots, and essentials.
3. **Automation and ingestion:** statement imports, categorization rules, recurring entries, notifications, and selected live valuations.
4. **Account and platform management:** authentication, privacy, profiles, subscriptions, export, and deletion.

The most important implementation lesson is that the dashboard is only the presentation layer. A comparable application depends on a reliable financial data model, consistent currency and transaction calculations, careful import handling, and clear privacy boundaries.

For an initial build, prioritize the asset/liability ledger, transactions, accounts, net worth calculations, and dashboard. Then add imports, budgets, insights, snapshots, and goals. Leave complex broker integrations, shared financial profiles, live pricing, and specialized planning tools until the underlying data model is stable.

**Final qualification:** This is a detailed research-based feature specification, not a complete hands-on audit of every authenticated screen. It should serve as a strong planning document for selecting and designing equivalent functionality, with the unverified items above treated as mandatory follow-up work before claiming feature parity.# FinBoom Website Audit and Feature Specification

<text color="secondary" size="sm">Audit target: https://www.finboom.app/ · Reference date: October 9, 2026</text>

This report will distinguish **observed functionality**, **interactions verified through available evidence**, and **features that require further investigation**. The objective is to produce an implementation-oriented specification for building a comparable personal finance application, not to reproduce FinBoom's branding or proprietary assets.

The supplied dashboard establishes several important starting points: FinBoom is positioned as a privacy-first personal finance app, with navigation for wealth, transactions, essentials, imports, calculators, updates, and settings. Its dashboard also exposes net worth, assets, liabilities, monthly cash flow, recent activity, investments, snapshots, and financial goals.

One important limitation: I don't have a live browser-control session in this conversation that lets me click through the signed-in website and observe every resulting state. I can examine the supplied page information and investigate publicly accessible website routes, but I will not describe an interaction as tested unless there is evidence for it. Features that require an account, user data, or Pro access will be marked accordingly.

## 1. Website Overview

<row align=start gap={3}>
  <box flex="1" gap={1}>
    <title size="lg">FinBoom</title>
    <text color="secondary" size="sm">Personal finance and wealth tracking</text>
    FinBoom consolidates personal wealth, investments, debts, income, expenses, and financial goals into one dashboard. It emphasizes manual data entry and spreadsheet imports instead of requiring bank or brokerage credentials. <Cite refs={["turn687444search0","turn687444search2"]}/>
    <text color="secondary" size="sm">Website: [finboom.app](https://www.finboom.app/)</text>
  </box>
  <AsyncImage query="personal finance wealth tracking dashboard net worth investments expenses clean web app interface" aspectRatio="4:3" width="124px"/>
</row>

### 1.1 Target users

- Individuals tracking their net worth across different asset classes.
- Investors with stocks, mutual funds, retirement savings, property, gold, and other holdings.
- People tracking household income, expenses, liabilities, and savings goals.
- Users importing portfolios and transactions from broker or bank statements.
- Families and business owners who need separate financial profiles and consolidated reporting.

These user groups are inferred from the site's advertised features, not from a verified customer demographic study. <Cite refs={["turn687444search0","turn687444search1"]}/>

### 1.2 Core value proposition

| Capability | User benefit |
|---|---|
| Consolidated wealth tracking | Understand assets, liabilities, and net worth together. |
| Money management | Track income, expenses, transfers, and spending patterns. |
| Investment tracking | Organize multiple asset classes and currencies. |
| Data import | Reduce manual entry using supported financial exports. |
| Financial planning | Track goals, budgets, insurance, and emergency savings. |
| Historical tracking | Capture and compare net worth over time. |
| Privacy-oriented design | Control what financial information is entered and imported. |
| Financial calculators | Model investment returns, recurring investments, and loan payments. |

The public website advertises support for more than 20 asset classes and multi-currency tracking. The supplied dashboard identifies INR as its current display currency. Currency counts differ across public pages and dated product announcements, so the exact current supported count requires confirmation. <Cite refs={["turn687444search0","turn687444search1","turn687444search2"]}/>

### 1.3 Evidence and verification conventions

The report uses the following labels:

- <badge color="success">Observed</badge> Directly present in the supplied page or an accessible public page.
- <badge color="info">Documented</badge> Described in official product documentation or release notes, but not independently exercised in this audit.
- <badge color="warning">Unverified</badge> Requires an authenticated session, a suitable account, or direct interaction.
- <badge>Inferred</badge> A reasonable implementation conclusion, not a confirmed internal design.

**Audit boundary:** The dashboard's rendered content was supplied in the conversation. Directly opening `/dashboard` without that session redirected to `/login?callbackUrl=/dashboard`. Consequently, this report can document the supplied dashboard and public product documentation, but cannot claim to have exhaustively tested the authenticated application. <Cite refs={["turn687444view0","turn687444search1"]}/>

---

## 2. Complete Feature Inventory

This inventory groups the features into functional modules. Detailed specifications, priorities, and implementation complexity appear in later sections.

<text color="secondary" size="sm">Priority is my assessment for a comparable product, not FinBoom's internal roadmap. Evidence status describes the available evidence, not feature quality.</text>

### 2.1 Dashboard and overview

| Feature | Purpose | Evidence |
|---|---|---|
| Net worth summary | Present consolidated financial position | Observed |
| Asset and liability summary | Show holdings and debts | Observed |
| Asset/liability allocation | Show the proportion of each side of the balance sheet | Observed |
| Monthly cash-flow summary | Show monthly income and expenses | Observed in dashboard; further details documented |
| Recent activity | Show recent recorded transactions | Observed |
| Quick-add actions | Navigate to expense, asset, snapshot, and import flows | Observed |
| Investments summary | Surface investment performance information | Observed; calculation details unverified |
| Goal summary | Show goal count, progress indicator, and off-track count | Observed |
| Privacy toggle | Conceal displayed financial totals | Documented in release notes |
| Financial health score | Summarize financial health | Documented in release notes |
| Navigation to detailed modules | Open assets, liabilities, transactions, and other sections | Observed |

### 2.2 Wealth and assets

| Feature | Purpose | Evidence |
|---|---|---|
| Asset register | Manage financial and physical holdings | Observed/documented |
| Asset-class filtering | Filter holdings by category, such as real estate or equity | Observed |
| Asset creation and editing | Record and maintain individual assets | Routes and release notes |
| Liabilities register | Track loans and other debts | Observed/documented |
| Loan details | Inspect an individual loan | Documented |
| Investment allocation | Break down holdings by investment type | Documented |
| Multi-currency valuation | Normalize asset values into a display currency | Documented |
| Live asset prices | Refresh eligible investment valuations | Documented as a Pro feature |
| Instrument classification | Assign investments to appropriate categories | Documented |
| Investment cost tracking | Store invested amounts alongside current values | Documented |
| Asset tags and geography | Organize assets by metadata | Documented |
| Loan repayment history | Inspect payment and principal/interest breakdowns | Documented |
| Loan amortization schedule | Model loan repayment over time | Documented |
| Loan prepayment calculator | Estimate interest and tenure effects of extra payments | Documented |

### 2.3 Transactions and money management

| Feature | Purpose | Evidence |
|---|---|---|
| Expense tracking | Record and classify spending | Observed/documented |
| Income tracking | Record earnings and other inflows | Observed/documented |
| Account-to-account transfers | Track movements of money | Documented |
| Cross-currency transfers | Record transfers between differently denominated accounts | Documented |
| Transaction filters | Narrow records by period and other criteria | Documented |
| Month grouping | Organize transactions chronologically | Documented |
| Search and selection | Find and select records for bulk operations | Partially documented |
| Bulk categorization | Change categories for multiple transactions | Documented |
| Transaction cloning | Reuse an existing transaction as a template | Documented |
| Transaction tags | Add organizational labels | Documented |
| Running totals | Sum selected transactions | Documented |
| Custom categories | Define and maintain income and expense categories | Documented |
| Category rules | Automatically classify transactions using matching rules | Documented |
| Recurring templates | Schedule regular income and expenses | Documented |
| Budget management | Set and manage a spending plan | Observed by route; details documented |
| Budget-exempt categories | Exclude designated categories from budget calculations | Documented |
| Inline arithmetic | Calculate expressions in amount fields | Documented |

### 2.4 Import and data management

| Feature | Purpose | Evidence |
|---|---|---|
| General CSV import | Import structured transaction data | Documented |
| Spreadsheet template import | Add assets and financial records from templates | Documented |
| Bank statement import | Convert statements into transactions | Documented for supported formats |
| Broker portfolio import | Import stocks, ETFs, and mutual funds | Documented |
| Mutual fund consolidated statement import | Import multiple fund holdings from one statement | Documented |
| Import review and categorization | Review proposed transactions and correct classifications | Documented |
| Duplicate detection | Flag potentially duplicated imported transactions | Documented |
| Account assignment | Link imported records to the appropriate account | Documented |
| Password-protected statement support | Supply a password for an encrypted statement | Documented for MFCentral CAS import |
| Export to CSV and JSON | Extract user data | Documented in privacy policy |
| Import from additional brokers | Support broker-specific export formats | Documented; coverage is format-dependent |
| Import transfers | Include transfers in general transaction imports | Documented |

### 2.5 Financial planning and analysis

| Feature | Purpose | Evidence |
|---|---|---|
| Net worth snapshots | Preserve a historical financial position | Observed/documented |
| Automatic snapshots | Capture financial position on a schedule | Documented as Pro |
| Snapshot comparison | Compare financial positions across dates | Documented |
| Money insights | Analyze income and expenses | Observed by route; details documented |
| Monthly trend chart | Compare income and expenses over time | Documented |
| Category analysis | Break down spending by category | Documented |
| Account-filtered insights | Analyze selected financial accounts | Documented |
| Savings rate | Estimate the share of income saved | Documented |
| Budget analysis | Compare planned and actual spending | Documented |
| Goal tracking | Monitor progress toward financial objectives | Observed/documented |
| Inflation-adjusted goal planning | Estimate the effect of inflation on targets | Documented |
| Financial essentials | Track insurance and emergency savings | Observed/documented |
| Debt ratio | Show a debt-related financial health measure | Documented |
| Financial health score | Provide an overall financial health indicator | Documented |

### 2.6 Calculators

The public product documentation identifies six free financial calculators. <Cite refs={["turn687444search1","turn687444search5","turn687444search6"]}/>

| Calculator | Purpose | Evidence |
|---|---|---|
| XIRR | Estimate annualized returns for dated cash flows | Public page |
| SIP | Project periodic investment growth | Public page |
| Lumpsum | Project returns from a one-time investment | Release notes |
| EMI | Estimate loan payments | Release notes |
| CAGR | Calculate annualized growth | Release notes |
| Fixed-deposit maturity | Estimate maturity value | Release notes |

### 2.7 Settings, account, and platform features

| Feature | Purpose | Evidence |
|---|---|---|
| Account and preferences | Manage personal application settings | Observed by route; details documented |
| Google sign-in | Authenticate through Google | Public landing page |
| Email/password sign-in | Authenticate with email credentials | Login page |
| Account creation | Register a new user | Login page |
| Password recovery | Recover account access | Login page |
| Financial profiles | Separate household or business records | Documented as Pro |
| Consolidated profiles | View combined wealth across profiles | Documented as Pro |
| Shared access | Allow others to view or manage financial data | Documented as Pro |
| App lock | Protect app access with a PIN | Documented |
| Notification settings | Configure selected alerts | Documented |
| Text-size preferences | Adjust application text size | Documented |
| Install app | Install or launch the application through supported platform flows | Observed/documented |
| Feedback | Send suggestions to the product team | Observed |
| What's New | Review product releases and fixes | Public page |
| Subscription management | View or manage Pro access | Observed by route; terms document cancellation |
| Data export | Download personal data | Documented |
| Account deletion | Permanently remove account data | Documented |

### 2.8 Notifications and recurring automation

| Feature | Purpose | Evidence |
|---|---|---|
| Deposit and bond maturity reminders | Notify users of approaching or completed maturities | Documented |
| Email notifications | Deliver supported reminders by email | Documented |
| In-app notification bell | Display notifications within the application | Documented |
| Recurring transaction generation | Create regular transactions from templates | Documented |
| Recurring loan EMI tracking | Record scheduled loan payments | Documented |
| Weekly financial summary email | Deliver a financial summary | Documented in release notes |
| Category-rule application | Reuse classification decisions on future imports | Documented |

**AI-specific functionality:** No dedicated AI assistant or generative AI tool is established by the supplied dashboard or the public product evidence reviewed here. Automated categorization, reminders, calculators, and import processing are not, by themselves, proof of generative AI. An AI module should not be included in a replica specification without additional evidence.

---

## 3. Page and Navigation Inventory

### 3.1 Global navigation

The supplied authenticated dashboard shows the following navigation structure. Routes below are the observed relative paths.

<box border radius="lg" padding={3} gap={2}>
  <row align="center" gap={2}>
    <icon name="layout-dashboard" size="lg"/>
    <box flex="1" gap={1}>
      **Overview**
      <text color="secondary" size="sm">`/dashboard` — financial summary and quick actions</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="landmark" size="lg"/>
    <box flex="1" gap={1}>
      **Wealth**
      <text color="secondary" size="sm">`/assets` — assets and investment holdings</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="wallet" size="lg"/>
    <box flex="1" gap={1}>
      **Money**
      <text color="secondary" size="sm">`/transactions` — income, expenses, and transfers</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="shield-check" size="lg"/>
    <box flex="1" gap={1}>
      **Essentials**
      <text color="secondary" size="sm">`/essentials` — financial safety-net tracking</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="file-up" size="lg"/>
    <box flex="1" gap={1}>
      **Import**
      <text color="secondary" size="sm">`/import` — data ingestion</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="calculator" size="lg"/>
    <box flex="1" gap={1}>
      **Calculators**
      <text color="secondary" size="sm">`/calculators` — public financial tools</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="history" size="lg"/>
    <box flex="1" gap={1}>
      **What's New**
      <text color="secondary" size="sm">`/whats-new` — product release history</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="center" gap={2}>
    <icon name="settings" size="lg"/>
    <box flex="1" gap={1}>
      **Settings**
      <text color="secondary" size="sm">`/settings` — account, preferences, profiles, billing, and data controls</text>
    </box>
  </row>
</box>

The dashboard also exposes an Add action, an Install App option, Feedback, a Pro upgrade link, and a profile control. The exact expanded contents of the Add menu and profile menu have not been inspected.

### 3.2 Page-by-page breakdown

The following inventory separates pages whose public content was examined from routes known only through the supplied dashboard or product documentation.

| Page or route | Purpose and visible content | Actions and relationships | Audit status |
|---|---|---|---|
| `/` | Marketing landing page, product features, sample dashboard, pricing, testimonials, FAQs | Get started, live demo, calculators, privacy, pricing links | Public page inspected |
| `/login` | Authentication page with Google sign-in, email, password, sign-in, forgot-password, and account creation options | Authenticate or register | Public page inspected |
| `/dashboard` | Net worth, monthly activity, assets, liabilities, investment summary, goals, quick-add links | Navigate to financial modules and add records | Supplied dashboard inspected; live route redirects to login |
| `/assets` | Asset list and investment holdings | Add, search, filter, edit, and organize holdings, as documented | Route known; protected content not independently inspected |
| `/assets/new` | New asset workflow | Enter an asset and save it | Route observed; form unverified |
| `/assets?class=REAL_ESTATE` | Real estate filter | Restrict assets by class | Route observed |
| `/assets?class=EQUITY` | Equity filter | Restrict assets by class | Route observed |
| `/liabilities` | Liabilities and debt records | Inspect or manage loans | Route observed |
| `/transactions` | Unified transaction management | Filter, add, edit, categorize, clone, and select transactions | Route observed; detailed behavior documented |
| `/expenses/new` | New expense workflow | Enter and save an expense | Route observed; form unverified |
| `/budget` | Spending plan | Review and manage category budgets | Route observed; behavior documented |
| `/money/insights` | Income and spending analysis | Explore trends and category/account breakdowns | Route observed; behavior documented |
| `/essentials` | Financial essentials check | Review insurance, emergency fund, and savings measures | Route observed; details documented |
| `/accounts` | Financial account management | Create, organize, and select accounts | Route observed through release notes and dashboard |
| `/snapshots` | Historical net worth snapshots | Create and compare snapshots | Route observed; workflow documented |
| `/import` | Import entry point | Upload statements, templates, or supported portfolio exports | Route observed; form inaccessible in this audit |
| `/calculators` | Calculator directory | Navigate to individual calculators | Public page inspected |
| `/calculators/xirr` | Investment return analysis | Enter dated or periodic cash flows and estimate annualized returns | Public page inspected |
| `/calculators/sip` | Periodic investment projection | Enter monthly amount, return, duration, and optional step-up | Public page inspected |
| `/calculators/lumpsum` | One-time investment projection | Enter amount, return, and period | Public page inspected |
| `/calculators/cagr` | Annualized growth calculation | Enter initial value, final value, and period | Public page inspected |
| `/calculators/emi` | Loan repayment estimate | Enter loan amount, rate, and tenure | Public page inspected |
| `/calculators/fd` | Fixed-deposit projection | Enter amount, rate, tenure, and compounding frequency | Public page inspected |
| `/settings` | Account and application configuration | Preferences, data controls, profile management, billing | Route observed; authenticated content unavailable |
| `/settings?tab=plan&coupon=OCT15` | Plan upgrade entry point | View or upgrade plan with a promotional code | Route observed; checkout untested |
| `/whats-new` | Release notes and feature history | Review product changes and fixes | Public page inspected |
| `/privacy` | Privacy policy | Review data handling and security disclosures | Public page inspected |
| `/terms` | Terms of service | Review service terms, plans, and cancellation rules | Public page inspected |
| `/refund-policy` | Refund and cancellation policy | Review eligibility and support process | Public page inspected |

Public page evidence: <Cite refs={["turn998659view0","turn687444view0","turn998659view1","turn165366view0","turn998659view3","turn998659view4","turn165366view4","turn165366view5","turn165366view6","turn165366view7","turn165366view1","turn165366view2","turn165366view3"]}/>

### 3.3 Navigation relationships

A developer building an equivalent application should model the following relationships.

<CodeBlock language="mermaid" editable={false}>
flowchart TD
    A[Overview / Dashboard] --> B[Wealth]
    A --> C[Money]
    A --> D[Essentials]
    A --> E[Snapshots]
    A --> F[Import]
    A --> G[Calculators]
    A --> H[Settings]
    B --> B1[Assets]
    B --> B2[Liabilities]
    B --> B3[Accounts]
    B --> B4[Allocation]
    C --> C1[Transactions]
    C --> C2[Budget]
    C --> C3[Insights]
    C --> C4[Money Settings]
    H --> H1[Preferences]
    H --> H2[Profiles]
    H --> H3[Billing and Plan]
    H --> H4[Data Export and Deletion]
</CodeBlock>

The page groupings and some destinations are documented by the product's release notes. The exact sidebar expansion behavior and current tab structure require authenticated inspection. <Cite refs={["turn998659view1","turn165366view2"]}/>

---

## 4. Detailed Feature Specifications

This section translates the inventory into a practical build specification. Inputs and outputs explicitly described in official documentation are distinguished from implementation recommendations.

### 4.1 Net worth and overview dashboard

<row align=start gap={3}>
  <AsyncImage query="personal finance dashboard net worth balance sheet assets liabilities monthly cash flow card chart web application" aspectRatio="4:5" maxWidth="140px"/>
  <box flex="1" gap={1}>
    **Purpose:** Give users a single summary of their financial position and current activity.

    **Location:** `/dashboard`

    **Priority:** P0

    **Complexity:** High
  </box>
</row>

**Observed components**

- Net worth heading and selected currency.
- Privacy-redacted monetary values.
- A link to create a snapshot.
- Quick-add links for expense, asset, snapshot, and import.
- Monthly income/expense summary and add-income/add-expense links.
- Budget and insights shortcuts.
- Recent activity section with an empty-state message.
- Asset and liability counts and summaries.
- Investment change indicator.
- Goal count, change indicator, and off-track count.

**Expected business logic**

A comparable implementation should calculate:

\[
\text{Net Worth}=\text{Total Assets}-\text{Total Liabilities}
\]

For a multi-currency portfolio, values should be converted into a chosen base currency before aggregation. This is a necessary design implication of the advertised multi-currency functionality, not a claim that every exchange-rate edge case was tested.

**Inputs:** Saved assets, liabilities, transactions, selected currency, and any applicable filters or profile selection.

**Outputs:** Financial totals, activity summaries, trend indicators, and links to more detailed pages.

**Workflow**

1. Load the current user's financial records.
2. Calculate aggregate assets and liabilities.
3. Convert relevant values to the display currency.
4. Compute net worth and the relevant period summaries.
5. Render cards and navigation shortcuts.
6. Apply the privacy display preference to monetary values.
7. Allow the user to navigate into a detailed record list or create a new record.

**Dependencies:** Asset register, liability register, accounts, transaction engine, currency conversion, snapshots, goals, and profile management.

**Validation and edge cases to support:** No records, missing valuations, mixed currencies, negative net worth, closed loans, deleted records, stale FX rates, and profiles with different base currencies.

The exact rules behind the dashboard's investment percentage, change indicators, and goal status have not been established. They must be verified before reproducing those calculations.

### 4.2 Asset management

**Purpose:** Store a consolidated register of investments and other property.

**Locations:** `/assets`, `/assets/new`, asset-class-filtered routes.

**Priority:** P0. **Complexity:** Very High.

**Documented capabilities**

- Support for Indian investment types, including stocks, mutual funds, real estate, gold, EPF, PPF, NPS, SSY, SGBs, ULIPs, fixed deposits, and crypto.
- Asset-class filters.
- Search across asset tags.
- Asset values, invested amounts, and allocation percentages.
- Multi-currency holdings.
- Live price refresh for eligible assets on Pro.
- Geographic and tagging metadata.
- Investments split across allocation types, such as mixed equity/debt holdings.
- Maturity labels and notifications for supported deposits and bonds.

<Cite refs={["turn998659view0","turn998659view1"]}/>

**Inputs:** Asset name, class, value, currency, and any additional asset-specific information. Quantity, invested amount, geography, tags, and maturity information are supported or documented for relevant asset types.

**Outputs:** Asset register rows, class totals, allocation percentages, and values used by net worth and goal calculations.

**Implementation workflow**

1. Open the asset register.
2. Search or filter existing holdings.
3. Select Add Asset to open the creation form.
4. Enter the required details and any applicable optional metadata.
5. Validate required fields and numeric values.
6. Save the record and update the register and aggregate totals.
7. Allow subsequent editing or deletion.
8. If supported for the instrument, refresh the market price and recompute valuation.

Steps 2–8 are a proposed implementation sequence consistent with documented functionality; the exact FinBoom form controls and save feedback were not directly tested.

**Rules and dependencies**

- An asset may contribute to more than one allocation bucket when its investment composition is split.
- Account balances excluded from investment allocation may still contribute to net worth.
- Currency conversion must precede comparable-value sorting.
- Investment instrument identity must remain stable across re-imports.
- Asset deletion should reconcile downstream totals and snapshots according to an explicit product policy.

**Unverified:** The full list of required fields by asset class, supported manual valuation modes, validation messages, and deletion confirmation behavior.

### 4.3 Liabilities and loan management

**Purpose:** Track outstanding debt and model repayment progress.

**Location:** `/liabilities`, with loan-specific detail views documented in release notes.

**Priority:** P1. **Complexity:** High.

**Documented capabilities**

- Education, home, personal, vehicle, gold, business, and friends/family loans.
- Loan metadata such as lender, collateral, principal, due date, and account number.
- Loan filtering and sorting.
- Loan amortization schedules.
- Prepayment scenarios.
- Repayment history with principal and interest breakdown.
- EMI automation linked to recurring templates and payment accounts.
- Loan closure and outstanding balance tracking.

**Inputs:** Loan principal, interest rate, tenure, loan type, lender, repayment schedule, and applicable account details.

**Outputs:** Outstanding liability, payment history, EMI estimates, principal/interest allocation, and projected debt-free date.

**Dependencies:** Transaction records, recurring templates, account management, and the calculator engine.

**Important business rule:** A repayment that reduces principal must update the outstanding balance without incorrectly restoring the original principal. Product release notes explicitly document a past bug in this area. <Cite refs={["turn998659view1","turn687444search1"]}/>

**Unverified:** Whether every loan type shares the same form, whether interest rates can vary over time, and the exact accounting behavior for early settlement.

### 4.4 Transactions: income, expenses, and transfers

**Purpose:** Provide a unified ledger for day-to-day money movements.

**Location:** `/transactions`, with `/expenses/new` as a shortcut for expense entry.

**Priority:** P0. **Complexity:** High.

**Documented features**

- A unified transaction page for expenses, income, and transfers.
- Monthly totals and month-grouped records.
- Period filters.
- Category and tag support.
- Bulk recategorization.
- Cloning existing transactions.
- Selection of multiple records and a combined running total.
- Cross-currency transfers.
- Custom income and expense categories.
- Arithmetic expressions inside amount inputs.
- Category rules that can be saved when correcting a transaction.

**Inputs:** Transaction type, amount, currency/account, date, category, description or note, and optional tags.

**Outputs:** Updated transaction list, monthly summaries, category totals, insights, and budget consumption.

**Workflow**

1. Open Transactions or use a quick-add shortcut.
2. Select the transaction type.
3. Enter the amount, date, account, and category.
4. Enter any optional note or tags.
5. Save the record.
6. Review the new entry in the list.
7. Filter or select records for editing, cloning, recategorization, or analysis.

This is an implementation specification based on advertised and documented behavior, not a live-tested sequence.

**Business rules**

- Account currency should determine or inform the transaction currency.
- Transfers must not be counted as ordinary income or spending in cash-flow analysis.
- Cross-currency transfers require amounts and currency treatment on both sides.
- Bulk actions must apply only to selected records.
- Category changes can optionally create rules for future transactions.
- A transaction must not be double-counted in monthly trends.

The release history confirms fixes for multi-currency entries, transfer imports, investment double-counting, and category selection on mobile. <Cite refs={["turn998659view1","turn687444search1"]}/>

### 4.5 Accounts and account organization

**Purpose:** Represent the financial accounts associated with transactions and balances.

**Location:** `/accounts`, under the Money module.

**Priority:** P1. **Complexity:** Medium–High.

**Documented capabilities**

- Assign imported transactions to an account.
- Link recurring templates to accounts.
- Reorder accounts using drag-and-drop, then save the order.
- Exclude selected accounts from investment allocation without removing them from net worth.
- Filter transactions by account.
- Support transfers between accounts and currencies.

**Inputs:** Account name and currency, plus whatever account metadata the creation form requires.

**Outputs:** An ordered account list, account-specific transaction views, and balances that feed the broader financial summary.

**Dependencies:** Transactions, imports, currency handling, allocation, and recurring templates.

**Unverified:** Full account types, opening-balance treatment, reconciliation features, and the exact account deletion rules.

### 4.6 Budget management

**Purpose:** Set spending limits and identify overspending.

**Location:** `/budget`.

**Priority:** P1. **Complexity:** Medium–High.

**Documented capabilities**

- Category-level budget configuration.
- Budget-exempt categories.
- Customization of categories through Money Settings.
- Alerts at 80% of a category budget and when a budget is exceeded.
- A reminder on the 15th of the month for categories spending quickly.
- Clearing an existing budget by saving an empty plan.

**Inputs:** Budget period, category limits, and any exclusion settings.

**Outputs:** Budget consumption, category-level status, and alerts.

**Recommended calculation**

\[
\text{Budget Usage}=\frac{\text{Eligible Spending}}{\text{Budget Limit}}\times100\%
\]

The formula is a standard implementation approach; the precise treatment of refunds, transfers, and date boundaries needs testing against the application.

**Dependencies:** Transaction classification, category rules, recurring transactions, and notifications.

**Edge cases:** Zero budget, overspending, missing categories, refunds, transfers, month rollover, and changing a category's exclusion status after transactions already exist.

### 4.7 Money insights

**Purpose:** Explain cash flow and spending patterns beyond a simple ledger.

**Location:** `/money/insights`.

**Priority:** P1. **Complexity:** High.

**Documented capabilities**

- Monthly income/expense trends.
- Category-level spending breakdowns.
- Recurring-spending analysis.
- Savings-rate indicators.
- Account filters.
- Bulk selection of categories or tags.
- Corrected chart logic to prevent investment transactions from being counted twice.

**Inputs:** Date range or period, account selection, and category/tag filters where available.

**Outputs:** Summary metrics, trend charts, category breakdowns, and spending insights.

**Recommended dependency design:** A shared transaction aggregation service should feed the dashboard, budget, and insights modules. This reduces the risk of the same transaction producing different totals in different parts of the application.

**Unverified:** Exact chart types, drill-down behavior, export options, and the formulas used for savings rate and recurring monthly run rate.

### 4.8 Financial essentials

**Purpose:** Help users monitor whether key financial safeguards are in place.

**Location:** `/essentials`.

**Priority:** P1. **Complexity:** Medium–High.

**Documented capabilities**

- Term insurance coverage.
- Health insurance coverage.
- Emergency fund tracking.
- Monthly income and expenses.
- Savings-related indicators.
- Debt ratio and financial health score.
- Recommendations based on a user's financial profile.
- Profile-specific essentials for Pro users.

**Inputs:** Insurance cover, income, expenses, emergency savings, and relevant profile information.

**Outputs:** Coverage indicators, emergency-fund progress, savings measures, and financial health feedback.

**Example implementation formulas**

\[
\text{Savings}=\text{Monthly Income}-\text{Monthly Expenses}
\]

\[
\text{Savings Rate}=\frac{\text{Savings}}{\text{Monthly Income}}\times100\%
\]

These are conventional candidate formulas, not confirmed formulas for all FinBoom indicators.

**Validation:** Prevent invalid negative coverage values and handle zero income without division errors. Display the assumptions behind any recommendations.

**Unverified:** The complete scoring model, thresholds for adequate insurance, and the exact definition of debt ratio.

### 4.9 Goals and financial targets

**Purpose:** Turn long-term objectives into trackable financial targets.

**Location:** Dashboard goal summary; the exact goal-management route was not established in the supplied content.

**Priority:** P1. **Complexity:** High.

**Documented capabilities**

- Create goals such as retirement and education funding.
- Link assets to goals.
- Show goal progress.
- Identify off-track goals.
- Account for inflation in target planning.
- Support multiple goals and profile-specific goals.

**Inputs:** Goal name, target amount, target date, inflation assumptions, and linked assets where applicable.

**Outputs:** Progress percentage, projected funding position, and on-track/off-track status.

**Recommended implementation sequence**

1. Create a goal with target and deadline.
2. Configure any inflation assumptions.
3. Link eligible assets.
4. Calculate progress using the selected goal methodology.
5. Display status and allow the user to update the goal.

**Unverified:** Whether linked assets are allocated exclusively to a single goal or may contribute to several goals, how overlapping goals are reconciled, and how status thresholds are calculated.

### 4.10 Net worth snapshots

**Purpose:** Preserve financial history for comparison.

**Location:** `/snapshots`, with dashboard shortcut.

**Priority:** P1. **Complexity:** Medium–High.

**Documented capabilities**

- Manually create a snapshot.
- Compare historical financial positions.
- Display month-over-month growth and detailed line items.
- Schedule automatic snapshots at weekly, biweekly, or monthly intervals for Pro users.

**Inputs:** Current financial data and, where scheduling is available, a snapshot frequency.

**Outputs:** A timestamped financial record and comparison data.

**Implementation considerations**

A snapshot should preserve a historical state rather than simply point at mutable current records. Otherwise, editing an old asset could inadvertently change historical reporting.

The exact snapshot schema, historical FX treatment, and whether automatic snapshots include every profile were not verified.

### 4.11 Import engine

**Purpose:** Reduce manual data entry by translating external financial exports into application records.

**Location:** `/import`.

**Priority:** P1. **Complexity:** Very High.

**Documented import families**

- General CSV data.
- CSV/Excel templates.
- Zerodha, Groww, Upstox, Angel One, ICICI Direct, mstock, 5paisa, and Dhan investment exports.
- MFCentral consolidated mutual fund statements.
- Vested and Tickertape exports.
- Supported bank statements, including specified HDFC, IDFC FIRST, Kotak, ABN Amro, Revolut, and Trade Republic formats.

These are documented examples, not a guarantee that every version of every provider's export is supported. <Cite refs={["turn998659view1","turn687444search1"]}/>

**Inputs:** A supported file, and optionally an account selection, statement password, or category corrections.

**Expected outputs:** Parsed assets or transactions, suggested categories, account associations, and a reviewable import result.

**Recommended workflow**

1. Choose the import source or file type.
2. Select the file.
3. Parse and validate its format.
4. Preview detected records.
5. Identify likely duplicates.
6. Assign accounts and correct categories.
7. Resolve errors or unsupported rows.
8. Confirm import.
9. Display a result summary and refresh affected records.

**Critical business rules**

- Do not silently discard transactions merely because another account has a similar record.
- Preserve manually corrected categories when rules are applicable.
- Keep investment instrument identity stable during re-import.
- Treat transfers separately from income and expenses.
- Handle locked files and malformed inputs with actionable errors.
- Make the final commit idempotent where possible, so repeated submissions do not create duplicate records.

The workflow above is the recommended architecture based on documented import features; the actual screen-by-screen review and error handling remain untested.

### 4.12 Financial calculators

The calculator directory is one of the strongest publicly inspectable parts of the website. It explicitly says calculations run in the browser and entered values are not saved or sent anywhere. <Cite refs={["turn165366view0","turn165366view4"]}/>

<box gap={3}>
  <row align=start gap={3}>
    <AsyncImage query="financial investment XIRR calculator form annualized return results interface" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **XIRR calculator** — `/calculators/xirr`

      <text color="secondary" size="sm">Priority P2 · Medium complexity</text>

      Inputs include currency, a SIP or custom cash-flow mode, investment amounts, investment dates or duration, and current value as applicable. Outputs include annualized return, invested amount, gain, and absolute return.

      The page distinguishes irregular cash flows from a single lump-sum investment. <Cite refs={["turn998659view4"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="SIP mutual fund investment calculator monthly investment annual return step up projected value interface" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **SIP calculator** — `/calculators/sip`

      <text color="secondary" size="sm">Priority P2 · Medium complexity</text>

      Inputs include monthly contribution, expected annual return, duration, duration unit, currency, and optional annual step-up. Outputs include projected value, total invested, and estimated returns.

      The documented calculation assumes monthly compounding and contributions at the start of each month. <Cite refs={["turn998659view3"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="lump sum investment future value calculator financial planning form" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **Lumpsum calculator** — `/calculators/lumpsum`

      <text color="secondary" size="sm">Priority P2 · Low–Medium complexity</text>

      Inputs: one-time investment, expected return, and investment period. Outputs: projected value, original investment, and estimated returns.

      The documented model compounds annually at a constant assumed return. <Cite refs={["turn165366view5"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="CAGR calculator initial value final value annual growth rate finance web form" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **CAGR calculator** — `/calculators/cagr`

      <text color="secondary" size="sm">Priority P2 · Low complexity</text>

      Inputs: initial value, final value, period, and currency. Outputs: compound annual growth rate and total growth.

      Standard calculation: \(\text{CAGR}=(\text{Final}/\text{Initial})^{1/t}-1\), where \(t\) is the duration in years. The actual page exposes a years/months choice. <Cite refs={["turn165366view6"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="loan EMI calculator principal interest tenure monthly payment results chart" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **EMI calculator** — `/calculators/emi`

      <text color="secondary" size="sm">Priority P2 · Medium complexity</text>

      Inputs: loan amount, annual interest rate, tenure, currency, and years/months unit. Outputs: monthly EMI, principal, total interest, and total payment.

      The public page specifies the standard reducing-balance formula with monthly compounding. <Cite refs={["turn165366view4"]}/>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <AsyncImage query="fixed deposit FD maturity calculator principal interest rate compounding frequency results" aspectRatio="3:4" maxWidth="96px"/>
    <box flex="1" gap={1}>
      **Fixed-deposit calculator** — `/calculators/fd`

      <text color="secondary" size="sm">Priority P2 · Medium complexity</text>

      Inputs: deposit amount, interest rate, tenure, currency, duration unit, and compounding frequency. Outputs: maturity value, original deposit, and interest earned.

      The documented calculation assumes the chosen rate remains constant for the full period. <Cite refs={["turn165366view7"]}/>
    </box>
  </row>
</box>

**Additional observations**

- The calculator directory marks a systematic withdrawal plan (SWP) with inflation and a retirement calculator as “Soon.” These should be classified as announced or planned, not as available functionality. <Cite refs={["turn165366view0"]}/>
- The calculator pages include explanatory content, FAQs, related-calculator links, and financial disclaimers.
- The XIRR, SIP, EMI, and CAGR pages should be tested for zero values, negative cash flows, invalid durations, missing fields, and extreme inputs before being treated as production-ready equivalents.

### 4.13 Settings, privacy, and subscriptions

**Purpose:** Manage account access, personal preferences, data portability, and paid access.

**Location:** `/settings` and related settings tabs.

**Priority:** P1. **Complexity:** High.

**Documented capabilities**

- Google OAuth and email/password authentication.
- Password recovery and email verification.
- App lock using a PIN.
- Text-size controls.
- Profile and base-currency configuration.
- Shared access and multi-profile functionality on Pro.
- Notification preferences.
- Data export to CSV or JSON.
- Account deletion.
- Pro upgrade and cancellation.
- Feedback submission and app installation.

The privacy policy also states that the product does not connect to financial institutions, and that the app uses a session cookie for authentication. <Cite refs={["turn165366view1","turn165366view2"]}/>

**Recommended account-deletion workflow**

1. Open Settings and find the data or Danger Zone section.
2. Export important data first.
3. Review the deletion warning.
4. Confirm the irreversible action.
5. Invalidate active sessions and remove the account's associated data according to the product's deletion policy.
6. Present a clear completion state.

The policy documents permanent deletion as a feature; this audit did not perform it.

**Subscription rules documented in the current terms**

- Free tier: up to 25 assets, 5 liabilities, 3 goals, and 2 snapshots per month.
- Pro six-month plan: ₹599.
- Pro yearly plan: ₹749.
- Pro lifetime offer: ₹3,499, subject to the stated offer period and availability.
- Existing data remains available after downgrading, even when records exceed free-tier limits.
- Pro features remain active until the applicable paid period ends after cancellation.
- The refund policy states a seven-day refund window for Pro purchases.

<Cite refs={["turn165366view2","turn165366view3"]}/>

These are published terms, not checkout-tested results. The site's promotional offer may change; current purchase terms should be checked at the point of payment.

---

## 5. User Journey Documentation

The journeys below distinguish publicly documented workflows from sequences that still need direct application testing.

### 5.1 First-time onboarding and dashboard setup

<badge color="success">Documented journey</badge>

1. Open the landing page.
2. Choose Get Started Free.
3. Register using Google or email/password.
4. Complete the requested profile setup and any email-verification step.
5. Add an asset manually or use a supported import.
6. Review the dashboard's net worth, asset allocation, and financial summaries.
7. Add liabilities, transactions, goals, or essentials information as needed.

**Expected result:** The dashboard reflects the financial data entered by the user.

**Edge cases to test:** Interrupted email verification, duplicate registration, invalid credentials, empty portfolios, and a user who starts onboarding but does not finish. The release notes document saving onboarding answers when email verification interrupts signup. <Cite refs={["turn998659view0","turn998659view1"]}/>

### 5.2 Add and maintain an asset

<badge>Workflow to verify in app</badge>

1. Open Wealth.
2. Select the asset creation action.
3. Choose or enter an asset category.
4. Provide required details and valuation.
5. Select currency and optional metadata where applicable.
6. Save the record.
7. Confirm that the asset appears in the list and dashboard totals.
8. Reopen it to edit or delete it.

**Expected result:** A valid asset contributes to the relevant asset-class total and net worth.

**Important tests:** Missing names, invalid amounts, currency conversion, asset edits after a snapshot, multi-category allocations, and the deletion/undo flow.

### 5.3 Import a bank statement

<badge>Documented capabilities; exact UI untested</badge>

1. Open Import.
2. Choose a supported statement format.
3. Upload the file and provide any required password.
4. Select the destination account if the importer offers that option.
5. Review parsed transactions and duplicate warnings.
6. Correct categories or apply category rules.
7. Resolve unsupported or invalid rows.
8. Confirm the import.
9. Check that the imported records appear in Transactions.

**Expected result:** Valid records become transactions associated with the selected account.

**Edge cases:** Encrypted PDFs, incorrect passwords, malformed CSVs, mixed currencies, duplicate imports, transfers, and partial import failures.

### 5.4 Correct a category and save a rule

<badge color="success">Documented workflow</badge>

1. Find a transaction with an incorrect category.
2. Edit its category.
3. Choose the option to save the correction as a rule.
4. Specify the merchant or text match if required.
5. Save the rule.
6. Import a future statement or apply the rule to existing transactions.
7. Verify that matching records receive the intended category.

The release notes describe rules based on text such as a merchant name, with limits of 25 rules for Free and 500 for Pro. Rule editing is also documented. <Cite refs={["turn998659view1"]}/>

**Important tests:** Case sensitivity, partial matches, conflicting rules, overlapping merchants, and a category that changes after a rule has been created.

### 5.5 Create a budget and respond to alerts

<badge color="success">Documented capabilities</badge>

1. Open Budget.
2. Configure a category spending limit.
3. Record or import eligible expenses.
4. Monitor category usage.
5. Receive an alert at 80% consumption.
6. Receive an over-budget alert if spending exceeds the limit.
7. Review the mid-month reminder if a category is spending quickly.
8. Adjust the budget or review the transactions.

The 80% alert, over-budget alert, and mid-month reminder are documented in the release history. <Cite refs={["turn998659view1"]}/>

**Important tests:** Budget resets, exempt categories, refunds, transfers, late-arriving transactions, and whether alerts are sent once or repeatedly.

### 5.6 Create and compare a snapshot

<badge>Workflow to verify in app</badge>

1. Open Snapshots from the dashboard or navigation.
2. Choose the manual snapshot action.
3. Confirm the financial state being captured.
4. Save the snapshot.
5. Open a previous snapshot.
6. Compare values and line items.
7. If enabled, configure automatic snapshot frequency.

**Expected result:** A historical financial position that can be compared with a later one.

**Important tests:** Whether snapshots preserve historical currency conversion, what happens after deleting an asset, and whether automatic captures can be duplicated.

### 5.7 Calculate a financial projection

<badge color="success">Public form structure documented</badge>

1. Open the calculator directory.
2. Select a calculator.
3. Enter the amount and rate inputs.
4. Choose the duration and its unit.
5. Adjust optional inputs, such as SIP step-up or FD compounding frequency.
6. Review the projected output.
7. Change an input and confirm the result recalculates.
8. Use the result for planning, recognizing that it depends on assumptions.

**Expected result:** A calculated projection or return estimate displayed in the browser.

**Privacy behavior:** The public calculator directory states that calculations run locally in the browser and the entered values are not saved or sent anywhere. This claim was documented on the public page, not independently verified with network inspection. <Cite refs={["turn165366view0","turn998659view3","turn165366view4"]}/>

### 5.8 Upgrade, cancel, export, or delete

<badge>Policy documented; execution untested</badge>

**Upgrade**

1. Open the Pro upgrade link or Settings → Plan.
2. Review available plans and current pricing.
3. Apply a promotion if eligible.
4. Complete the payment flow.
5. Confirm that the account reflects the new entitlement.

**Cancel**

1. Open Settings.
2. Locate the plan or billing section.
3. Initiate cancellation.
4. Confirm the applicable end date and retained access.

**Export**

1. Open Settings.
2. Find the data export function.
3. Choose CSV or JSON where offered.
4. Download the data and verify its completeness.

**Delete**

1. Export data if needed.
2. Review subscription implications.
3. Open the Danger Zone.
4. Confirm permanent deletion.

The last three workflows are based on published policy, not observed clicks. In particular, the actual payment provider, export screen, and deletion confirmation UX remain unverified. <Cite refs={["turn165366view1","turn165366view2","turn165366view3"]}/>

---

## 6. UI/UX Analysis

### 6.1 Design language and information hierarchy

The supplied dashboard and public pages suggest a finance-oriented interface built around summary cards, compact metrics, tables or lists, and direct navigation to detailed views.

<box gap={2}>
  <row align=start gap={3}>
    <AsyncImage query="minimal modern finance dashboard card grid net worth dark navy white interface" aspectRatio="4:3" maxWidth="124px"/>
    <box flex="1" gap={1}>
      **Summary-first design**

      Major financial totals appear before detailed records. This is appropriate for a personal finance product because users often want their net worth and current-month position before inspecting individual transactions.
    </box>
  </row>
  <row align=start gap={3}>
    <AsyncImage query="personal finance app asset allocation donut chart compact metric cards" aspectRatio="4:3" maxWidth="124px"/>
    <box flex="1" gap={1}>
      **Progressive disclosure**

      The overview presents counts, categories, and summary values, then links to full asset, liability, or transaction views. This avoids placing every record on the dashboard.
    </box>
  </row>
  <row align=start gap={3}>
    <AsyncImage query="accessible financial application transaction list filters compact rows mobile responsive interface" aspectRatio="4:3" maxWidth="124px"/>
    <box flex="1" gap={1}>
      **Action-oriented navigation**

      Quick-add links, contextual links, and module-specific actions reduce the number of steps required for common tasks.
    </box>
  </row>
</box>

These images are illustrative design references, not screenshots of FinBoom. Exact font families, color values, spacing tokens, and the full desktop/mobile layouts have not been measured.

### 6.2 Reusable components worth implementing

| Component | Recommended behavior |
|---|---|
| Financial metric card | Label, formatted value, optional change indicator, click-through |
| Quick-add action | Clear entry point into a specific creation workflow |
| Empty state | Explain why no data appears and offer a relevant next action |
| Search/filter toolbar | Search, category, date, account, and sort controls as applicable |
| Financial record row | Name, category, amount, metadata, and contextual actions |
| Privacy toggle | Redact financial values consistently across the application |
| Progress indicator | Display goal or budget progress with a textual status |
| Allocation visualization | Show investment proportions and associated values |
| Modal/form | Validate inputs and preserve entered values when changing form modes |
| Notification item | Explain the event and link to the relevant record |
| Upgrade prompt | Present plan limits and a direct path to plan details |
| Undo feedback | Allow recovery from supported deletion actions |
| Calculator result panel | Display calculated output alongside assumptions and input controls |

### 6.3 Tables, charts, and data density

Product release notes describe a dense asset table, month-grouped transactions, monthly trends, allocation visualizations, snapshot comparisons, and charts with compact summary cards. They also document mobile-specific improvements to holdings tables and category selection. <Cite refs={["turn998659view1"]}/>

For a comparable implementation:

- Use full amounts in detailed transaction rows; reserve abbreviated numbers for compact cards when needed.
- Keep sorting and filtering close to the list they affect.
- Distinguish asset allocation from account balances.
- Make chart legends and category colors understandable without relying on color alone.
- Use accessible text labels and keyboard-operable controls.
- Provide a card-based or otherwise responsive layout on small screens.
- Preserve filter and tab state when navigating back or refreshing, where appropriate.

These are implementation recommendations, not assertions that every behavior is currently present.

### 6.4 Forms, feedback, and error states

The public release history provides evidence that FinBoom has addressed:

- Category selection on mobile.
- Preservation of form values when switching to bulk entry.
- Validation errors in financial essentials.
- App-lock setup reliability.
- Duplicate detection during imports.
- Undo for deletion across supported record types.

<Cite refs={["turn998659view1"]}/>

A comparable product should also define explicit states for:

- Initial loading and data refresh.
- No records yet.
- Search returned no matches.
- Invalid or incomplete input.
- Failed imports and partial success.
- Network or server errors.
- Save success and undo availability.
- Subscription-required actions.
- Expired sessions and authentication errors.

The actual wording and appearance of most of FinBoom's feedback states were not directly observed.

### 6.5 Responsive and accessibility considerations

The release history documents a mobile category picker with larger tap targets, a holdings table that fits phone screens, a mobile card view for recurring templates, and a text-size preference. Tablet rotation is also mentioned. <Cite refs={["turn998659view1"]}/>

**Confirmed:** Responsive improvements and adjustable text size are documented.

**Not verified:** Exact breakpoints, keyboard navigation, screen-reader announcements, color contrast, focus order, and full accessibility compliance.

For a new implementation, these should be explicit acceptance criteria rather than assumptions based on visual similarity.

---

## 7. Technical Observations

### 7.1 Confirmed or publicly documented architecture clues

| Area | Observation | Confidence |
|---|---|---|
| Hosting and HTTPS | Privacy policy says HTTPS is enforced and describes a hosting provider, but does not name it | Documented |
| Database | Privacy policy identifies PostgreSQL on AWS infrastructure | Documented |
| Access control | Row-level security is described as enforcing user isolation | Documented |
| Authentication | Google OAuth and email/password authentication are documented | Documented |
| Session management | Signed, expiring session tokens and a session cookie are described | Documented |
| Password storage | Passwords are described as securely hashed | Documented |
| FX rates | A third-party FX rate provider is used, but its name is not disclosed on the policy page | Documented |
| Payments | A payment processor handles payment data; provider identity is unverified | Documented |
| Data export | CSV and JSON exports are advertised | Documented |
| Calculator computation | Public calculator pages state that calculations run in the browser | Documented |
| Bank connectivity | The product says it does not connect directly to banks or brokerages | Documented |
| Analytics | The policy describes anonymous page-view analytics and says third-party trackers are not used | Documented |

Sources: <Cite refs={["turn165366view1","turn165366view2","turn165366view0"]}/>

### 7.2 Navigation and routing

The observable site uses conventional URL paths and query parameters, for example:

- `/dashboard`
- `/assets?class=EQUITY`
- `/settings?tab=plan&coupon=OCT15`
- `/login?callbackUrl=/dashboard`

The login redirect suggests protected routes require authentication and may preserve a requested destination through a callback parameter. This is an observation about navigation behavior, not proof of the underlying framework or complete authorization implementation.

### 7.3 Import and asynchronous behavior

Documented features imply several background or asynchronous operations:

- File parsing and record validation.
- Import review and duplicate detection.
- Exchange-rate retrieval.
- Market-price refresh.
- Scheduled recurring transaction generation.
- Automatic snapshots.
- Email and in-app notifications.

The exact job scheduler, queue technology, retry policy, API design, and background worker architecture are not visible from the available evidence.

### 7.4 Framework and library indicators

No framework or charting library can be reliably identified from the public page text alone. The evidence does not justify claiming that FinBoom uses React, Next.js, Supabase, a particular charting library, or a particular payment gateway.

The privacy policy names PostgreSQL and AWS-hosted infrastructure; it does **not** independently establish the use of Supabase. Where another marketing statement mentions a hosting/database arrangement, that statement should not be treated as source-code verification.

### 7.5 Privacy and data-handling design

The documented design favors explicit user control:

- Manual data entry and statement imports rather than direct account linking.
- Financial data export.
- Account deletion.
- User-level data isolation.
- Local calculations for public calculators.
- No use of user financial data for AI training, according to the privacy policy.

<Cite refs={["turn165366view1","turn165366view2"]}/>

For a comparable product, data isolation, encryption, auditability of destructive actions, and export completeness should be treated as core architectural requirements, not optional UI enhancements.

---

## 8. Feature Prioritization

The priorities below are recommended for building a comparable application. They reflect user value, dependencies, and implementation effort—not FinBoom's internal engineering priorities.

### 8.1 Priority definitions

| Priority | Meaning | Build strategy |
|---|---|---|
| P0 — Core | Required for the product's main purpose | Implement and validate first |
| P1 — High value | Makes the product substantially more useful | Build after the core data flows work |
| P2 — Enhancement | Improves convenience, analysis, or usability | Add after core workflows stabilize |
| P3 — Advanced/optional | Specialized, expensive, or lower-frequency functionality | Add based on demand and available resources |

### 8.2 Prioritized implementation roadmap

<text color="secondary" size="sm">Complexity estimates assume a production-quality application with authentication, persistent data, validation, and automated tests.</text>

| Feature | Priority | Complexity | Main dependencies |
|---|---|---|---|
| Authentication and account isolation | P0 | High | Identity provider, sessions, authorization |
| Asset register and valuation | P0 | Very High | Database, asset categories, currencies |
| Liabilities and net worth calculations | P0 | High | Asset and liability records |
| Unified income/expense/transfer ledger | P0 | High | Accounts, categories, transaction rules |
| Overview dashboard | P0 | High | All core financial modules |
| Manual add/edit/delete flows | P0 | Medium–High | Forms, validation, persistence |
| Currency selection and conversion | P0 | High | FX data source, rounding, stale-rate handling |
| Privacy toggle for financial values | P0 | Low–Medium | Shared display-state management |
| CSV import and data validation | P0 | High | Parser, mapping, duplicate detection |
| Data export | P0 | Medium | Export schema, permissions |
| Goal tracking | P1 | High | Asset valuations, target dates |
| Snapshots and historical comparison | P1 | High | Historical state preservation |
| Budget and category limits | P1 | Medium–High | Transaction aggregation |
| Money insights and trend charts | P1 | High | Consistent aggregation service |
| Financial essentials | P1 | Medium–High | User inputs, scoring rules |
| Account management | P1 | Medium–High | Transactions, currencies |
| Broker and bank-statement import adapters | P1 | Very High | Provider-specific parsers and fixtures |
| Recurring income and expense templates | P1 | High | Scheduler, transactions, idempotency |
| Loan repayment and amortization | P1 | High | Loan model, interest calculations |
| Notification system | P1 | High | Events, scheduler, email delivery |
| Category rules and bulk recategorization | P1 | Medium–High | Matching rules, conflict resolution |
| Family/business profiles | P1 | Very High | Authorization, profile isolation, aggregation |
| Shared access | P2 | Very High | Permissions, invitations, auditing |
| Live market-price refresh | P2 | Very High | Pricing providers, instrument mapping |
| Investment performance analytics | P2 | High | Valuation history, cash-flow analysis |
| Financial calculators | P2 | Medium | Financial formulas, input validation |
| Transaction cloning and running totals | P2 | Low–Medium | Transaction list and selection |
| Installable app experience | P2 | Medium | Manifest, icons, platform behavior |
| App lock with PIN | P2 | Medium–High | Secure local state, lifecycle handling |
| Advanced allocation targets | P2 | High | Asset classifications, profile rules |
| Automated snapshots | P2 | High | Scheduling and historical storage |
| Additional broker-specific formats | P2 | High per adapter | Fixtures, parsing and validation |
| Advanced retirement/SWP planning | P3 | High | Projection assumptions and calculators |
| Generative AI financial assistant | P3 | Very High | Not confirmed as a FinBoom feature; separate product decision |

### 8.3 Recommended build order

<box border radius="lg" padding={3} gap={3}>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="layers" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 1 — Financial foundation**

      Authentication, user isolation, currencies, assets, liabilities, accounts, transactions, and net worth calculations.

      <badge>P0</badge>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="layout-dashboard" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 2 — Core user experience**

      Dashboard, search and filters, forms, empty states, data export, and privacy controls.

      <badge>P0</badge>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="chart-no-axes-combined" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 3 — Planning and analysis**

      Snapshots, budgets, goals, insights, and financial essentials.

      <badge>P1</badge>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="file-up" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 4 — Automation and integrations**

      Import adapters, recurring templates, category rules, notifications, and loan automation.

      <badge>P1</badge>
    </box>
  </row>
  <divider color="subtle"/>
  <row align=start gap={3}>
    <box background="surface-secondary" radius="md" padding={2} align="center" justify="center">
      <icon name="sparkles" size="xl"/>
    </box>
    <box flex="1" gap={1}>
      **Phase 5 — Advanced capabilities**

      Live pricing, shared profiles, advanced performance analysis, and specialized planning tools.

      <badge>P2–P3</badge>
    </box>
  </row>
</box>

**Key architectural recommendation:** Build a consistent financial data model and calculation layer before implementing advanced charts. Net worth, budgets, insights, goal progress, snapshots, and loan repayment all depend on the correctness of shared financial records.

---

## 9. Limitations and Unverified Features

### 9.1 Authentication and account restrictions

The dashboard URL redirected to a login page in the independent public-page inspection. The supplied authenticated dashboard content was still available as context, but there was no live authenticated browser session for further interaction.

I did not bypass authentication, access controls, or payment restrictions.

### 9.2 What remains unverified

| Area | What still needs inspection |
|---|---|
| Add menu | Every action, dropdown, modal, and available record type |
| Dashboard | Exact chart interactions, tooltips, period selectors, and card drill-downs |
| Assets | Full create/edit forms, field validation, deletion confirmation, sorting, and pagination |
| Liabilities | Every loan form, repayment controls, schedule editing, and closure workflow |
| Transactions | Exact filters, sort options, bulk-action menus, and pagination behavior |
| Accounts | Account creation, opening balances, reconciliation, and deletion rules |
| Budget | Full configuration UI, reset behavior, and alert settings |
| Insights | Chart interactions, export options, date controls, and formula definitions |
| Essentials | Exact scoring rules, thresholds, and recommendation calculations |
| Goals | Goal form, linking behavior, progress calculations, and goal-management route |
| Snapshots | Comparison interface, historical valuation rules, and automatic scheduling controls |
| Import | Full source selector, supported file formats in the live UI, error recovery, and import confirmation |
| Settings | Every tab, profile switcher, notification preference, and data-management control |
| Subscription | Checkout provider, payment confirmation, upgrade entitlements, and cancellation UI |
| Notifications | Notification center, read/unread state, and individual notification actions |
| Responsive behavior | Full authenticated mobile and tablet layouts |
| Accessibility | Keyboard navigation, screen-reader behavior, focus handling, and measured contrast |
| Loading and errors | Actual network failures, retry behavior, and error messages |
| AI functionality | No dedicated AI assistant was established by the available evidence |

### 9.3 Technical uncertainties

The following cannot be reliably established from the inspected page content:

- The frontend framework and exact component libraries.
- The complete backend architecture, database schema, and API contracts.
- The identity of the FX provider, payment processor, and hosting provider.
- The exact data retention and deletion behavior at every backend layer.
- The precise financial formulas for all dashboard metrics.
- Whether every documented feature is currently available to every account.
- The full inventory of responsive breakpoints and accessibility behaviors.

### 9.4 Documentation discrepancies

Public documentation can change at different times. In particular:

- Currency support counts differ across marketing copy and release history.
- The published pricing and feature entitlements should be verified at checkout before implementation.
- Some calculator tools are marked as upcoming rather than available.
- A release note establishes that a feature was announced or changed, not that every current account has it enabled.

The current public terms and refund policy agree on the advertised six-month, yearly, and lifetime prices, but the actual purchase flow was not tested. <Cite refs={["turn165366view2","turn165366view3","turn165366view0"]}/>

### 9.5 Inspection checklist

{@body const auditItems = [
{section:"Public pages",items:["Landing page and product positioning","Calculator directory and six calculator pages","Privacy policy, terms, and refund policy","What's New release history","Login and registration screen"]},
{section:"Authenticated application",items:["Dashboard and Add menu","Assets and asset creation","Liabilities and loan details","Transactions and bulk actions","Accounts and Money Settings","Budget and alerts","Money Insights","Essentials and goals","Snapshots and comparisons","Import and import review","Settings, profiles, and billing","Notifications and feedback"]},
{section:"Behavioral testing",items:["Form validation and save feedback","Search, sorting, and pagination","Loading, empty, and error states","Mobile layout and accessibility","Export, deletion, and undo behavior","Pro-gated functionality and entitlements"]}
]}
{@body const [checkedAudit,setCheckedAudit] = DIL.useState([])}
<box border radius="lg" padding={3} gap={3}>
  <row align="center" justify="between">
    <title size="md">Audit completion tracker</title>
    <text color="secondary" size="sm">{checkedAudit.length} / {auditItems.reduce((n,s)=>n+s.items.length,0)} marked</text>
  </row>
  <text color="secondary" size="sm">Mark items as you independently verify them. This checklist is for your own follow-up; it does not change the inspection evidence above.</text>
  {#each auditItems as section}
    <box gap={2} key={section.section}>
      <text weight="medium">{section.section}</text>
      {#each section.items as item}
        <checkbox key={item} checked={checkedAudit.includes(item)} onChange={v=>setCheckedAudit(old=>v?[...old,item]:old.filter(x=>x!==item))}>{item}</checkbox>
      {/each}
    </box>
  {/each}
  <button block variant="outline" onClick={() => GenUI.copy(auditItems.map(s=>s.section+"\n"+s.items.map(i=>(checkedAudit.includes(i)?"[x] ":"[ ] ")+i).join("\n")).join("\n\n"))}>Copy checklist</button>
</box>

---

## 10. Final Coverage Summary

### 10.1 Coverage accounting

These are counts of the audit's documented coverage, not counts of every screen or feature in the actual application.

| Measure | Result |
|---|---|
| Supplied authenticated dashboard | 1 inspected |
| Public landing page | 1 inspected |
| Authentication page | 1 inspected |
| Public calculator directory | 1 inspected |
| Individual public calculators | 6 inspected |
| Public legal/policy pages | 3 inspected |
| Public What's New page | 1 inspected |
| Additional authenticated route families identified | 12+ |
| Major feature modules documented | 12 |
| Individual feature entries | Dozens, grouped by module |
| User journeys documented | 8 |
| Live authenticated workflows tested | 0 |
| Dedicated AI assistant verified | 0 |
| Complete authenticated application coverage | Not achieved |

The page counts above describe the pages examined or identified in this report; they do not imply that all listed routes were independently accessible. Public calculator and policy content was inspectable, while authenticated routes could not be fully exercised.

### 10.2 Overall assessment

FinBoom is best understood as a personal financial management and wealth-tracking application with four major layers:

1. **Financial records:** assets, liabilities, accounts, transactions, and categories.
2. **Analysis and planning:** net worth, allocation, cash flow, budgets, goals, snapshots, and essentials.
3. **Automation and ingestion:** statement imports, categorization rules, recurring entries, notifications, and selected live valuations.
4. **Account and platform management:** authentication, privacy, profiles, subscriptions, export, and deletion.

The most important implementation lesson is that the dashboard is only the presentation layer. A comparable application depends on a reliable financial data model, consistent currency and transaction calculations, careful import handling, and clear privacy boundaries.

For an initial build, prioritize the asset/liability ledger, transactions, accounts, net worth calculations, and dashboard. Then add imports, budgets, insights, snapshots, and goals. Leave complex broker integrations, shared financial profiles, live pricing, and specialized planning tools until the underlying data model is stable.

**Final qualification:** This is a detailed research-based feature specification, not a complete hands-on audit of every authenticated screen. It should serve as a strong planning document for selecting and designing equivalent functionality, with the unverified items above treated as mandatory follow-up work before claiming feature parity.