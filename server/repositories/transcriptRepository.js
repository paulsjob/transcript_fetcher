import prisma from '../lib/prisma.js';

export async function upsertTranscript({ videoId, title, durationSeconds, transcript, analysis = null }) {
  const transcriptText = transcript.map((entry) => entry.text).join(' ').trim();
  const transcriptJson = JSON.stringify(transcript);

  return prisma.transcript.upsert({
    where: { videoId },
    update: {
      title,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
      transcriptText,
      transcriptJson,
      synopsis: analysis?.synopsis || null,
      keyPointsJson: JSON.stringify(analysis?.keyPoints || []),
      themesJson: JSON.stringify(analysis?.themes || []),
      tagsJson: JSON.stringify(analysis?.tags || []),
      notableQuotesJson: JSON.stringify(analysis?.notableQuotes || []),
      analysisStatus: analysis?.analysisStatus || null,
      analyzedAt: analysis?.analyzedAt || null,
      analysisVersion: analysis?.analysisVersion || null,
      fetchedAt: new Date()
    },
    create: {
      videoId,
      title,
      durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null,
      transcriptText,
      transcriptJson,
      synopsis: analysis?.synopsis || null,
      keyPointsJson: JSON.stringify(analysis?.keyPoints || []),
      themesJson: JSON.stringify(analysis?.themes || []),
      tagsJson: JSON.stringify(analysis?.tags || []),
      notableQuotesJson: JSON.stringify(analysis?.notableQuotes || []),
      analysisStatus: analysis?.analysisStatus || null,
      analyzedAt: analysis?.analyzedAt || null,
      analysisVersion: analysis?.analysisVersion || null
    }
  });
}

function safeParseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapTranscriptRecord(record) {
  return {
    ...record,
    keyPoints: safeParseJsonArray(record.keyPointsJson),
    themes: safeParseJsonArray(record.themesJson),
    tags: safeParseJsonArray(record.tagsJson),
    notableQuotes: safeParseJsonArray(record.notableQuotesJson)
  };
}

export async function searchTranscripts(query) {
  return prisma.transcript.findMany({
    where: {
      OR: [
        { title: { contains: query } },
        { transcriptText: { contains: query } },
        { synopsis: { contains: query } },
        { tagsJson: { contains: query } },
        { themesJson: { contains: query } },
        { keyPointsJson: { contains: query } }
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
      themesJson: true,
      tagsJson: true
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
      transcriptText: true,
      durationSeconds: true,
      synopsis: true,
      keyPointsJson: true,
      themesJson: true,
      tagsJson: true,
      analysisStatus: true
    },
    orderBy: {
      fetchedAt: 'desc'
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
      durationSeconds: true,
      transcriptJson: true,
      transcriptText: true,
      synopsis: true,
      keyPointsJson: true,
      themesJson: true,
      tagsJson: true,
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
