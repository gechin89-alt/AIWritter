-- AlterTable
ALTER TABLE "User" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "logoPath" TEXT,
ADD COLUMN     "logoWatermarkEnabled" BOOLEAN NOT NULL DEFAULT true;
