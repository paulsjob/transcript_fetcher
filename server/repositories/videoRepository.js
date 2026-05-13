import prisma from '../lib/prisma.js';

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseTimestampLabelSeconds(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parts = value.trim().split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return null;
}

function secondsFromSegment(segment = {}) {
  if (Number.isFinite(segment.startSeconds)) return Math.max(0, Math.floor(segment.startSeconds));
  if (Number.isFinite(segment.start)) return Math.max(0, Math.floor(segment.start));
  return parseTimestampLabelSeconds(segment.start) ?? 0;
}

function formatTimestampLabel(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${paddedMinutes}:${paddedSeconds}`;
}

function toVimeoTimeFragment(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}m${seconds}s`;
}

function findMatchIndices(text = '', query = '') {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const matches = [];
  let searchFrom = 0;

  while (normalizedQuery && searchFrom <= normalizedText.length) {
    const index = normalizedText.indexOf(normalizedQuery, searchFrom);
    if (index === -1) break;
    matches.push({ start: index, end: index + query.length });
    searchFrom = index + query.length;
  }

  return matches;
}

function sourceDisplayName(video) {
  if (video.platform === 'vimeo') return 'Vimeo';
  return video.platform || 'Unknown source';
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

export async function searchTranscriptLines({ q = '', limit = 100 } = {}) {
  const query = q.trim();
  if (!query) return [];
  const take = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 100;

  const rows = await prisma.video.findMany({
    where: { transcriptText: { contains: query } },
    orderBy: [{ modifiedTime: 'desc' }, { fetchedAt: 'desc' }]
  });

  const matches = [];

  for (const video of rows.map(mapVideo)) {
    const segments = Array.isArray(video.transcriptJson) ? video.transcriptJson : [];

    for (const segment of segments) {
      const lineText = typeof segment?.text === 'string' ? segment.text : '';
      const matchIndices = findMatchIndices(lineText, query);
      if (!matchIndices.length) continue;

      const startSeconds = secondsFromSegment(segment);
      const videoId = video.externalId;
      const vimeoUrlAtTime = videoId ? `https://vimeo.com/${videoId}#t=${toVimeoTimeFragment(startSeconds)}` : null;

      matches.push({
        id: `${video.id}:${startSeconds}:${matches.length}`,
        contentItemId: video.id,
        videoId,
        title: video.title,
        sourceDisplayName: sourceDisplayName(video),
        platform: video.platform,
        publishedAt: video.createdTime,
        durationSeconds: video.durationSeconds,
        lineStartSeconds: startSeconds,
        lineTimestamp: segment.start ?? formatTimestampLabel(startSeconds),
        lineTimestampLabel: formatTimestampLabel(startSeconds),
        lineText,
        matchIndices,
        vimeoUrlAtTime
      });

      if (matches.length >= take) return matches;
    }
  }

  return matches;
}
