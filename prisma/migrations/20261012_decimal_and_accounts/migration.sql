-- DropIndex
DROP INDEX "Transaction_userId_category_idx";

-- DropIndex
DROP INDEX "Transaction_userId_date_idx";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "accountId" TEXT,
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(18,6),
ALTER COLUMN "avgBuyPrice" SET DATA TYPE DECIMAL(19,4),
ALTER COLUMN "currentPrice" SET DATA TYPE DECIMAL(19,4);

-- AlterTable
ALTER TABLE "Budget" ALTER COLUMN "monthlyLimit" SET DATA TYPE DECIMAL(19,4);

-- AlterTable
ALTER TABLE "Goal" ALTER COLUMN "targetAmount" SET DATA TYPE DECIMAL(19,4),
ALTER COLUMN "currentAmount" SET DATA TYPE DECIMAL(19,4),
ALTER COLUMN "monthlyRequired" SET DATA TYPE DECIMAL(19,4);

-- AlterTable
ALTER TABLE "Liability" ALTER COLUMN "principalAmount" SET DATA TYPE DECIMAL(19,4),
ALTER COLUMN "outstandingAmount" SET DATA TYPE DECIMAL(19,4),
ALTER COLUMN "monthlyEMI" SET DATA TYPE DECIMAL(19,4);

-- AlterTable
ALTER TABLE "Snapshot" ALTER COLUMN "totalAssets" SET DATA TYPE DECIMAL(19,4),
ALTER COLUMN "totalLiabilities" SET DATA TYPE DECIMAL(19,4),
ALTER COLUMN "netWorth" SET DATA TYPE DECIMAL(19,4);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "transferGroupId" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(19,4);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_closedAt_idx" ON "Account"("userId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");

-- CreateIndex
CREATE INDEX "Asset_userId_accountId_idx" ON "Asset"("userId", "accountId");

-- CreateIndex
CREATE INDEX "Transaction_userId_date_deletedAt_idx" ON "Transaction"("userId", "date", "deletedAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_category_deletedAt_idx" ON "Transaction"("userId", "category", "deletedAt");

-- CreateIndex
CREATE INDEX "Transaction_userId_accountId_idx" ON "Transaction"("userId", "accountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
