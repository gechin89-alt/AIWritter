-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandLink" TEXT NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Campaign" ("active", "brandLink", "createdAt", "id", "identityOptions", "identityQuestion", "name", "prizeInfo", "slug", "styleOptions", "styleQuestion", "termsText", "toneOptions", "toneQuestion") SELECT "active", "brandLink", "createdAt", "id", "identityOptions", "identityQuestion", "name", "prizeInfo", "slug", "styleOptions", "styleQuestion", "termsText", "toneOptions", "toneQuestion" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
