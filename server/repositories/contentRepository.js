import prisma from '../lib/prisma.js';
import { safeJsonStringify, safeParseJsonArray, safeParseJsonObject } from '../utils/json.js';

function mapContentRecord(record) {
  return {
    ...record,
    keyPoints: safeParseJsonArray(record.keyPointsJson),
    entities: safeParseJsonObject(record.entitiesJson, {
      people: [],
      organizations: [],
      places: [],
      programs: [],
      issues: []
    }),
    tags: safeParseJsonArray(record.tagsJson),
    themes: safeParseJsonArray(record.themesJson),
    sections: safeParseJsonArray(record.sectionsJson),
    notableQuotes: safeParseJsonArray(record.notableQuotesJson)
  };
}

export async function upsertContentItem({ sourceId, externalContentId, platform, contentType, title, transcript = [], bodyText = null, transcriptText = '', transcriptJson = null, url = null, publishedAt = null, fetchedAt = new Date(), durationSeconds = null, ingestStatus = 'completed', ingestError = null, rawMetadata = {}, analysis = null }) {
  const computedTranscriptText = transcriptText || transcript.map((entry) => entry.text).join(' ').trim();
  const computedTranscriptJson = transcriptJson || safeJsonStringify(transcript, '[]');

  const row = await prisma.contentItem.upsert({
    where: {
      sourceId_externalContentId: {
        sourceId,
        externalContentId
      }
    },
    update: {
      platform,
      contentType,
      title,
      transcriptText: computedTranscriptText || null,
      bodyText,
      transcriptJson: computedTranscriptJson,
      url,
      publishedAt,
      fetchedAt,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
      ingestStatus,
      ingestError,
      rawMetadataJson: safeJsonStringify(rawMetadata, '{}'),
      synopsis: analysis?.synopsis || null,
      keyPointsJson: safeJsonStringify(analysis?.keyPoints || [], '[]'),
      entitiesJson: safeJsonStringify(analysis?.entities || {}, '{}'),
      tagsJson: safeJsonStringify(analysis?.tags || [], '[]'),
      themesJson: safeJsonStringify(analysis?.themes || analysis?.tags || [], '[]'),
      sectionsJson: safeJsonStringify(analysis?.sections || [], '[]'),
      notableQuotesJson: safeJsonStringify(analysis?.notableQuotes || [], '[]'),
      analysisStatus: analysis?.analysisStatus || null,
      analyzedAt: analysis?.analyzedAt || null,
      analysisVersion: analysis?.analysisVersion || null,
      lastAttemptedAt: new Date()
    },
    create: {
      sourceId,
      externalContentId,
      platform,
      contentType,
      title,
      transcriptText: computedTranscriptText || null,
      bodyText,
      transcriptJson: computedTranscriptJson,
      url,
      publishedAt,
      fetchedAt,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
      ingestStatus,
      ingestError,
      rawMetadataJson: safeJsonStringify(rawMetadata, '{}'),
      synopsis: analysis?.synopsis || null,
      keyPointsJson: safeJsonStringify(analysis?.keyPoints || [], '[]'),
      entitiesJson: safeJsonStringify(analysis?.entities || {}, '{}'),
      tagsJson: safeJsonStringify(analysis?.tags || [], '[]'),
      themesJson: safeJsonStringify(analysis?.themes || analysis?.tags || [], '[]'),
      sectionsJson: safeJsonStringify(analysis?.sections || [], '[]'),
      notableQuotesJson: safeJsonStringify(analysis?.notableQuotes || [], '[]'),
      analysisStatus: analysis?.analysisStatus || null,
      analyzedAt: analysis?.analyzedAt || null,
      analysisVersion: analysis?.analysisVersion || null,
      lastAttemptedAt: new Date()
    },
    include: {
      source: true
    }
  });

  return mapContentRecord(row);
}

export async function markContentNoTranscript({ sourceId, externalContentId, platform, contentType = 'video', title = 'Untitled', durationSeconds = null, url = null, message = 'No subtitles available for this item' }) {
  return upsertContentItem({
    sourceId,
    externalContentId,
    platform,
    contentType,
    title,
    durationSeconds,
    url,
    transcript: [],
    ingestStatus: 'no_subtitles',
    ingestError: message,
    analysis: null
  });
}

export async function queryContentLibrary(filters = {}) {
  const where = {
    ingestStatus: { not: 'no_subtitles' }
  };

  if (filters.platform && filters.platform !== 'any') {
    where.platform = filters.platform;
  }

  if (filters.sourceId && filters.sourceId !== 'any') {
    where.sourceId = filters.sourceId;
  }

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q } },
      { transcriptText: { contains: filters.q } },
      { bodyText: { contains: filters.q } },
      { synopsis: { contains: filters.q } }
    ];
  }

  const rows = await prisma.contentItem.findMany({
    where,
    include: { source: true },
    orderBy: filters.sortBy === 'title'
      ? { title: filters.sortOrder === 'asc' ? 'asc' : 'desc' }
      : { [filters.sortBy === 'publishedAt' ? 'publishedAt' : 'fetchedAt']: filters.sortOrder === 'asc' ? 'asc' : 'desc' },
    take: 300
  });

  return rows.map(mapContentRecord);
}

export async function getContentById(id) {
  const row = await prisma.contentItem.findUnique({ where: { id }, include: { source: true } });
  return row ? mapContentRecord(row) : null;
}

export async function deleteContentById(id) {
  const result = await prisma.contentItem.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function findExistingExternalIds(sourceId, externalIds) {
  if (!Array.isArray(externalIds) || !externalIds.length) {
    return [];
  }

  const rows = await prisma.contentItem.findMany({
    where: { sourceId, externalContentId: { in: externalIds } },
    select: { externalContentId: true }
  });

  return rows.map((row) => row.externalContentId);
}

export async function findAllExternalIdsForSource(sourceId) {
  const rows = await prisma.contentItem.findMany({ where: { sourceId }, select: { externalContentId: true } });
  return rows.map((row) => row.externalContentId);
}
