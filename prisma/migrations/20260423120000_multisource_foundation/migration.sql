-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ingestSettings" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "externalContentId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "transcriptText" TEXT,
    "bodyText" TEXT,
    "transcriptJson" TEXT,
    "url" TEXT,
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" INTEGER,
    "ingestStatus" TEXT NOT NULL DEFAULT 'completed',
    "ingestError" TEXT,
    "rawMetadataJson" TEXT,
    "synopsis" TEXT,
    "keyPointsJson" TEXT,
    "entitiesJson" TEXT,
    "tagsJson" TEXT,
    "themesJson" TEXT,
    "sectionsJson" TEXT,
    "notableQuotesJson" TEXT,
    "analysisStatus" TEXT,
    "analyzedAt" DATETIME,
    "analysisVersion" TEXT,
    "lastAttemptedAt" DATETIME,
    CONSTRAINT "ContentItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "Source_platform_handle_key" ON "Source"("platform", "handle");
CREATE INDEX "Source_platform_idx" ON "Source"("platform");
CREATE INDEX "Source_isActive_idx" ON "Source"("isActive");

CREATE UNIQUE INDEX "ContentItem_sourceId_externalContentId_key" ON "ContentItem"("sourceId", "externalContentId");
CREATE INDEX "ContentItem_platform_idx" ON "ContentItem"("platform");
CREATE INDEX "ContentItem_sourceId_idx" ON "ContentItem"("sourceId");
CREATE INDEX "ContentItem_fetchedAt_idx" ON "ContentItem"("fetchedAt");
CREATE INDEX "ContentItem_publishedAt_idx" ON "ContentItem"("publishedAt");
CREATE INDEX "ContentItem_ingestStatus_idx" ON "ContentItem"("ingestStatus");

-- Migrate legacy Vimeo rows from Transcript if the table exists.
INSERT OR IGNORE INTO "Source" ("id", "platform", "handle", "displayName", "sourceUrl", "isActive", "ingestSettings", "metadataJson", "createdAt", "updatedAt")
SELECT
  'legacy-vimeo-default',
  'vimeo',
  COALESCE(NULLIF(TRIM(COALESCE(env.value, '')), ''), 'default'),
  'Vimeo Archive',
  COALESCE(NULLIF(TRIM(COALESCE(env.value, '')), ''), 'https://vimeo.com'),
  true,
  '{"bootstrap":"migration"}',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT 1) AS one
LEFT JOIN (
  SELECT value FROM pragma_compile_options WHERE 0
) AS noop ON 1 = 0
LEFT JOIN (
  SELECT '' AS value
) AS env ON 1 = 1;

INSERT OR IGNORE INTO "ContentItem" (
  "id", "sourceId", "externalContentId", "platform", "contentType", "title", "transcriptText", "bodyText", "transcriptJson", "url",
  "publishedAt", "fetchedAt", "durationSeconds", "ingestStatus", "ingestError", "rawMetadataJson", "synopsis", "keyPointsJson",
  "entitiesJson", "tagsJson", "themesJson", "sectionsJson", "notableQuotesJson", "analysisStatus", "analyzedAt", "analysisVersion", "lastAttemptedAt"
)
SELECT
  "id",
  'legacy-vimeo-default',
  "videoId",
  'vimeo',
  'video',
  "title",
  "transcriptText",
  NULL,
  "transcriptJson",
  ('https://vimeo.com/' || "videoId"),
  NULL,
  COALESCE("fetchedAt", CURRENT_TIMESTAMP),
  "durationSeconds",
  COALESCE("ingestStatus", 'completed'),
  "ingestError",
  NULL,
  "synopsis",
  "keyPointsJson",
  "entitiesJson",
  "tagsJson",
  "tagsJson",
  "sectionsJson",
  "notableQuotesJson",
  "analysisStatus",
  "analyzedAt",
  "analysisVersion",
  "lastAttemptedAt"
FROM "Transcript";

-- Drop legacy table after migration
DROP TABLE IF EXISTS "Transcript";
DROP INDEX IF EXISTS "Transcript_videoId_key";
DROP INDEX IF EXISTS "Transcript_ingestStatus_idx";
