-- AlterTable
ALTER TABLE "CommercialSubmission" ADD COLUMN     "editCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "editLimitOverride" INTEGER;

-- CreateIndex
CREATE INDEX "CommercialSubmission_campaignId_phone_idx" ON "CommercialSubmission"("campaignId", "phone");
