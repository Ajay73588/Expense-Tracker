-- AlterTable: portfolio import fields on Asset
ALTER TABLE "Asset" ADD COLUMN     "folio" TEXT,
ADD COLUMN     "importKey" TEXT,
ADD COLUMN     "isin" TEXT,
ADD COLUMN     "exchange" TEXT,
ADD COLUMN     "priceSource" TEXT,
ADD COLUMN     "priceUpdatedAt" TIMESTAMP(3);

-- CreateIndex: idempotent re-import (NULL importKey = manually created asset, allowed many times)
CREATE UNIQUE INDEX "Asset_userId_importKey_key" ON "Asset"("userId", "importKey");
