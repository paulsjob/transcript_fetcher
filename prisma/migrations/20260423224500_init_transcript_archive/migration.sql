-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "ingestStatus" TEXT NOT NULL DEFAULT 'completed',
    "ingestError" TEXT,
    "lastAttemptedAt" DATETIME,
    "transcriptText" TEXT NOT NULL,
    "transcriptJson" TEXT NOT NULL,
    "synopsis" TEXT,
    "keyPointsJson" TEXT,
    "entitiesJson" TEXT,
    "tagsJson" TEXT,
    "sectionsJson" TEXT,
    "notableQuotesJson" TEXT,
    "analysisStatus" TEXT,
    "analyzedAt" DATETIME,
    "analysisVersion" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_videoId_key" ON "Transcript"("videoId");

-- CreateIndex
CREATE INDEX "Transcript_ingestStatus_idx" ON "Transcript"("ingestStatus");
