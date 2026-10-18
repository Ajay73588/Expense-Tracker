# Phase 1: DATA-001 Float to Decimal Migration Plan

> **Status:** DONE
> **Target:** Replace `Float` with `Decimal(19,4)` for monetary values and `Decimal(18,6)` for asset quantities.

## 1. Background and Motivation
Currently, all monetary fields (`invested`, `currentValue`, `pnl`, `price`, etc.) and quantities are stored as `Float` in Prisma, which maps to `DOUBLE PRECISION` in PostgreSQL. This introduces floating-point precision errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). In a financial application, monetary precision is critical to ensure that balance sheets and P&L calculations balance exactly.

## 2. Schema Target Changes
In `prisma/schema.prisma`, fields will be updated:

**Asset model:**
- `quantity`: `Float` -> `Decimal` (Precision: 18, 6)
- `avgBuyPrice`: `Float` -> `Decimal` (Precision: 19, 4)
- `currentPrice`: `Float?` -> `Decimal?` (Precision: 19, 4)

**Transaction model:**
- `amount`: `Float` -> `Decimal` (Precision: 19, 4)

**Liability model:**
- `principalAmount`: `Float` -> `Decimal` (Precision: 19, 4)
- `outstandingAmount`: `Float` -> `Decimal` (Precision: 19, 4)
- `monthlyEMI`: `Float?` -> `Decimal?` (Precision: 19, 4)

**Goal model:**
- `targetAmount`: `Float` -> `Decimal` (Precision: 19, 4)
- `currentAmount`: `Float` -> `Decimal` (Precision: 19, 4)
- `monthlyRequired`: `Float?` -> `Decimal?` (Precision: 19, 4)

**Snapshot model:**
- `totalAssets`: `Float` -> `Decimal` (Precision: 19, 4)
- `totalLiabilities`: `Float` -> `Decimal` (Precision: 19, 4)
- `netWorth`: `Float` -> `Decimal` (Precision: 19, 4)

## 3. Application Code Impact
Prisma returns `Decimal` fields as `Prisma.Decimal` objects (which are instances of `decimal.js`).
This will break existing code that expects JavaScript `number`:

1. **Math operations:** `a.currentValue + b.currentValue` will fail. We must use `.plus()`, `.minus()`, `.times()`, `.dividedBy()`.
2. **Formatting:** `formatINR(asset.currentValue)` will fail if it strictly expects `number`. We need to convert `.toNumber()` at the formatting boundary, or update `formatINR` to accept `Decimal`.
3. **Services:** `AssetService.toPL` must be rewritten to perform all P&L math using `Decimal` and return `Decimal` or serialize to `number` if strictly for UI consumption.
4. **API Responses:** `NextResponse.json()` cannot natively stringify `Prisma.Decimal`. We must map decimals to `number` (or strings) before responding to the client.

## 4. Execution Steps

### Step 1: UI/API Boundary Audit
- Audit all responses returned by API routes. Ensure a serialization utility exists to safely map `Decimal` to `number` or `string` for the frontend.
- Update `formatINR` and `formatPercent` to accept `number | Prisma.Decimal`.

### Step 2: Service Layer Refactoring
- Rewrite `AssetService.toPL` to use `Prisma.Decimal`.
- Update `PortfolioService`, `NetWorthService`, and `HealthScoreService` aggregations. Use `.reduce()` with Decimal arithmetic.

### Step 3: Database Migration
- Since the app currently uses `prisma db push` and has no production users yet, we can safely apply the schema change via `prisma db push`. 
- **If production data existed:** We would need a zero-downtime migration, adding new Decimal columns, backfilling them, and then dropping the old Float columns. For now, altering the column type directly is sufficient but might cause data loss/truncation if not handled carefully by Prisma.

### Step 4: Testing and Verification
- Run the full test suite (`npm test`). Vitest mocks will need to be updated to return `new Prisma.Decimal(value)`.
- Re-run browser acceptance tests.

## 5. Rollback Plan
If precision issues or massive type errors occur during step 2/3:
- Revert the git commit touching `schema.prisma` and service files.
- Re-run `prisma db push` to restore `Float` column types.
