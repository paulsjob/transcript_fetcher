import prisma from '../lib/prisma.js';
import { safeJsonStringify, safeParseJsonArray, safeParseJsonObject } from '../utils/json.js';

export async function upsertTranscript({
  videoId,
  title,
  durationSeconds,
  transcript,
  analysis = null,
  ingestStatus = 'completed',
  ingestError = null
}) {
  const transcriptText = transcript.map((entry) => entry.text).join(' ').trim();
  const transcriptJson = safeJsonStringify(transcript, '[]');

  return prisma.transcript.upsert({
    where: { videoId },
    update: {
      title,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
      ingestStatus,
      ingestError,
      lastAttemptedAt: new Date(),
      transcriptText,
      transcriptJson,
      synopsis: analysis?.synopsis || null,
      keyPointsJson: safeJsonStringify(analysis?.keyPoints || [], '[]'),
      entitiesJson: safeJsonStringify(analysis?.entities || {}, '{}'),
      tagsJson: safeJsonStringify(analysis?.tags || [], '[]'),
      sectionsJson: safeJsonStringify(analysis?.sections || [], '[]'),
      notableQuotesJson: safeJsonStringify(analysis?.notableQuotes || [], '[]'),
      analysisStatus: analysis?.analysisStatus || null,
      analyzedAt: analysis?.analyzedAt || null,
      analysisVersion: analysis?.analysisVersion || null,
      fetchedAt: new Date()
    },
    create: {
      videoId,
      title,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
      ingestStatus,
      ingestError,
      lastAttemptedAt: new Date(),
      transcriptText,
      transcriptJson,
      synopsis: analysis?.synopsis || null,
      keyPointsJson: safeJsonStringify(analysis?.keyPoints || [], '[]'),
      entitiesJson: safeJsonStringify(analysis?.entities || {}, '{}'),
      tagsJson: safeJsonStringify(analysis?.tags || [], '[]'),
      sectionsJson: safeJsonStringify(analysis?.sections || [], '[]'),
      notableQuotesJson: safeJsonStringify(analysis?.notableQuotes || [], '[]'),
      analysisStatus: analysis?.analysisStatus || null,
      analyzedAt: analysis?.analyzedAt || null,
      analysisVersion: analysis?.analysisVersion || null
    }
  });
}

function mapTranscriptRecord(record) {
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
    sections: safeParseJsonArray(record.sectionsJson),
    notableQuotes: safeParseJsonArray(record.notableQuotesJson)
  };
}

export async function markNoSubtitles({
  videoId,
  title = 'Untitled Vimeo Video',
  durationSeconds = null,
  message = 'No subtitles available for this video'
}) {
  return upsertTranscript({
    videoId,
    title,
    durationSeconds,
    transcript: [],
    analysis: null,
    ingestStatus: 'no_subtitles',
    ingestError: message
  });
}

export async function searchTranscripts(query) {
  return prisma.transcript.findMany({
    where: {
      AND: [
        {
          ingestStatus: {
            not: 'no_subtitles'
          }
        },
        {
          OR: [
            { title: { contains: query } },
            { transcriptText: { contains: query } },
            { synopsis: { contains: query } },
            { tagsJson: { contains: query } },
            { entitiesJson: { contains: query } },
            { keyPointsJson: { contains: query } },
            { notableQuotesJson: { contains: query } }
          ]
        }
      ]
    },
    select: {
      id: true,
      videoId: true,
      title: true,
      transcriptText: true,
      transcriptJson: true,
      synopsis: true,
      keyPointsJson: true,
      entitiesJson: true,
      tagsJson: true,
      sectionsJson: true,
      notableQuotesJson: true
    },
    orderBy: {
      fetchedAt: 'desc'
    },
    take: 50
  }).then((rows) => rows.map(mapTranscriptRecord));
}

export async function listTranscripts() {
  return prisma.transcript.findMany({
    select: {
      id: true,
      videoId: true,
      title: true,
      fetchedAt: true,
      ingestStatus: true,
      ingestError: true,
      lastAttemptedAt: true,
      transcriptText: true,
      durationSeconds: true,
      synopsis: true,
      keyPointsJson: true,
      entitiesJson: true,
      tagsJson: true,
      sectionsJson: true,
      analysisStatus: true
    },
    orderBy: {
      fetchedAt: 'desc'
    },
    where: {
      ingestStatus: {
        not: 'no_subtitles'
      }
    }
  }).then((rows) => rows.map(mapTranscriptRecord));
}

export async function getTranscriptById(id) {
  return prisma.transcript.findUnique({
    where: { id },
    select: {
      id: true,
      videoId: true,
      title: true,
      fetchedAt: true,
      ingestStatus: true,
      ingestError: true,
      lastAttemptedAt: true,
      durationSeconds: true,
      transcriptJson: true,
      transcriptText: true,
      synopsis: true,
      keyPointsJson: true,
      entitiesJson: true,
      tagsJson: true,
      sectionsJson: true,
      notableQuotesJson: true,
      analysisStatus: true,
      analyzedAt: true,
      analysisVersion: true
    }
  }).then((record) => (record ? mapTranscriptRecord(record) : null));
}

export async function deleteTranscriptById(id) {
  const result = await prisma.transcript.deleteMany({
    where: { id }
  });

  return result.count > 0;
}

export async function findAllVideoIds() {
  const rows = await prisma.transcript.findMany({
    select: { videoId: true }
  });

  return rows.map((row) => row.videoId);
}

export async function findExistingVideoIds(videoIds) {
  if (!Array.isArray(videoIds) || !videoIds.length) {
    return [];
  }

  const rows = await prisma.transcript.findMany({
    where: {
      videoId: {
        in: videoIds
      }
    },
    select: { videoId: true }
  });

  return rows.map((row) => row.videoId);
}

export async function hasTranscriptByVideoId(videoId) {
  const transcript = await prisma.transcript.findUnique({
    where: { videoId },
    select: { id: true }
  });

  return Boolean(transcript);
}
