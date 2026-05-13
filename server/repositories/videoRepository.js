import prisma from '../lib/prisma.js';

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function mapVideo(row) {
  if (!row) return null;
  return {
    ...row,
    transcriptJson: safeParseJson(row.transcriptJson, []),
    rawMetadataJson: safeParseJson(row.rawMetadataJson, null)
  };
}

export async function upsertVideoMetadata(video) {
  const now = new Date();
  const data = {
    platform: 'vimeo',
    externalId: video.externalId,
    uri: video.uri || null,
    url: video.url || null,
    title: video.title || 'Untitled Vimeo video',
    description: video.description || null,
    durationSeconds: Number.isFinite(video.durationSeconds) ? video.durationSeconds : null,
    createdTime: video.createdTime ? new Date(video.createdTime) : null,
    modifiedTime: video.modifiedTime ? new Date(video.modifiedTime) : null,
    fetchedAt: now,
    rawMetadataJson: JSON.stringify(video.rawMetadata || video),
    lastAttemptedAt: now
  };

  const row = await prisma.video.upsert({
    where: { platform_externalId: { platform: 'vimeo', externalId: video.externalId } },
    update: data,
    create: {
      ...data,
      ingestStatus: 'pending',
      textTrackStatus: 'pending'
    }
  });

  return mapVideo(row);
}

export async function findVideoByExternalId(externalId) {
  const row = await prisma.video.findUnique({ where: { platform_externalId: { platform: 'vimeo', externalId } } });
  return mapVideo(row);
}

export async function markVideoCompleted(id, transcriptSegments, transcriptText) {
  const row = await prisma.video.update({
    where: { id },
    data: {
      transcriptText: transcriptText || null,
      transcriptJson: JSON.stringify(transcriptSegments || []),
      textTrackStatus: 'completed',
      ingestStatus: 'completed',
      ingestError: null,
      fetchedAt: new Date(),
      lastAttemptedAt: new Date()
    }
  });
  return mapVideo(row);
}

export async function markVideoNoSubtitles(id) {
  const row = await prisma.video.update({
    where: { id },
    data: {
      textTrackStatus: 'no_subtitles',
      ingestStatus: 'completed',
      ingestError: null,
      fetchedAt: new Date(),
      lastAttemptedAt: new Date()
    }
  });
  return mapVideo(row);
}

export async function markVideoFailed(id, errorMessage) {
  const row = await prisma.video.update({
    where: { id },
    data: {
      textTrackStatus: 'failed',
      ingestStatus: 'failed',
      ingestError: errorMessage || 'Vimeo ingest failed.',
      fetchedAt: new Date(),
      lastAttemptedAt: new Date()
    }
  });
  return mapVideo(row);
}

export async function listVideos({ q = '', take = 300 } = {}) {
  const where = q
    ? {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { transcriptText: { contains: q } }
        ]
      }
    : {};

  const rows = await prisma.video.findMany({
    where,
    orderBy: [{ modifiedTime: 'desc' }, { fetchedAt: 'desc' }],
    take
  });
  return rows.map(mapVideo);
}

export async function getVideoById(id) {
  const row = await prisma.video.findUnique({ where: { id } });
  return mapVideo(row);
}

export async function deleteVideoById(id) {
  const result = await prisma.video.deleteMany({ where: { id } });
  return result.count > 0;
}
