-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('XHS', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'POSTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "QuestionMode" AS ENUM ('FIXED', 'AI_ADAPTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "postLimit" INTEGER,
    "brandDescription" TEXT,
    "styleSampleText" TEXT,
    "brandImagePaths" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndividualPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaPath" TEXT,
    "identity" TEXT,
    "tone" TEXT,
    "style" TEXT,
    "freeText" TEXT,
    "platform" "Platform" NOT NULL DEFAULT 'XHS',
    "clarifyingHistory" TEXT NOT NULL DEFAULT '[]',
    "generatedContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndividualPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandLink" TEXT NOT NULL,
    "brandColor" TEXT,
    "logoPath" TEXT,
    "productDescription" TEXT,
    "prizeInfo" TEXT NOT NULL,
    "termsText" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "identityOptions" TEXT,
    "toneOptions" TEXT,
    "styleOptions" TEXT,
    "identityQuestion" TEXT,
    "toneQuestion" TEXT,
    "styleQuestion" TEXT,
    "identityIncludeOther" BOOLEAN NOT NULL DEFAULT false,
    "toneIncludeOther" BOOLEAN NOT NULL DEFAULT false,
    "styleIncludeOther" BOOLEAN NOT NULL DEFAULT false,
    "identityMultiSelect" BOOLEAN NOT NULL DEFAULT false,
    "toneMultiSelect" BOOLEAN NOT NULL DEFAULT false,
    "styleMultiSelect" BOOLEAN NOT NULL DEFAULT false,
    "questionMode" "QuestionMode" NOT NULL DEFAULT 'FIXED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prize" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imagePath" TEXT,
    "qty" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialSubmission" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "mediaPath" TEXT,
    "photoVariants" TEXT,
    "generatedContent" TEXT,
    "titleVariants" TEXT,
    "chosenTitle" TEXT,
    "xhsLink" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- AddForeignKey
ALTER TABLE "IndividualPost" ADD CONSTRAINT "IndividualPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialSubmission" ADD CONSTRAINT "CommercialSubmission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
