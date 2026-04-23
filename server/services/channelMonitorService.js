import ytDlp from 'yt-dlp-exec';
import { findAllExternalIdsForSource, findExistingExternalIds } from '../repositories/contentRepository.js';
import { ensureSource, listSources } from '../repositories/sourceRepository.js';
import { fetchAndStoreTranscriptByExternalId } from './transcriptService.js';

const DEFAULT_CONCURRENCY = 1;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getBootstrapSourcesFromEnv() {
  const sources = [];
  const vimeoArchiveUrl = process.env.VIMEO_ARCHIVE_URL?.trim() || process.env.VIMEO_CHANNEL_URL?.trim();
  if (vimeoArchiveUrl) {
    sources.push({
      platform: 'vimeo',
      handle: process.env.VIMEO_ARCHIVE_HANDLE?.trim() || 'default',
      displayName: process.env.VIMEO_ARCHIVE_NAME?.trim() || 'Vimeo Archive',
      sourceUrl: vimeoArchiveUrl,
      isActive: true,
      ingestSettings: { mode: 'playlist' }
    });
  }

  const youtubeSourceUrl = process.env.YOUTUBE_ARCHIVE_URL?.trim();
  if (youtubeSourceUrl) {
    sources.push({
      platform: 'youtube',
      handle: process.env.YOUTUBE_ARCHIVE_HANDLE?.trim() || 'default',
      displayName: process.env.YOUTUBE_ARCHIVE_NAME?.trim() || 'YouTube Archive',
      sourceUrl: youtubeSourceUrl,
      isActive: true,
      ingestSettings: { mode: 'playlist' }
    });
  }

  return sources;
}

async function ensureBootstrapSources() {
  const bootstrapped = [];
  for (const sourceDef of getBootstrapSourcesFromEnv()) {
    bootstrapped.push(await ensureSource(sourceDef));
  }
  return bootstrapped;
}

async function scrapeSourceExternalIds(source) {
  const jsonOutput = await ytDlp(source.sourceUrl, {
    flatPlaylist: true,
    dumpSingleJson: true,
    skipDownload: true,
    noWarnings: true,
    noCallHome: true
  });

  const parsed = typeof jsonOutput === 'string' ? JSON.parse(jsonOutput) : jsonOutput;
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const ids = entries.map((entry) => entry?.id).filter((id) => typeof id === 'string' && id.trim());
  if (ids.length) {
    return [...new Set(ids)];
  }

  if (typeof parsed?.id === 'string' && parsed.id.trim()) {
    return [parsed.id.trim()];
  }

  throw new Error(`No content IDs discovered for source ${source.platform}:${source.handle}`);
}

async function ingestExternalIds(source, externalIds, options = {}) {
  const existing = options.existingIds || new Set();
  const pendingIds = externalIds.filter((id) => !existing.has(id));
  const total = pendingIds.length;
  if (!total) return { discovered: externalIds.length, skipped: externalIds.length, attempted: 0, succeeded: 0, failed: 0 };

  const workerCount = Math.min(parsePositiveInt(options.concurrency, DEFAULT_CONCURRENCY), total);
  let index = 0;
  let succeeded = 0;
  let failed = 0;

  async function worker() {
    while (index < total) {
      const current = index;
      index += 1;
      const externalId = pendingIds[current];
      try {
        await fetchAndStoreTranscriptByExternalId({ platform: source.platform, externalId, source });
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    discovered: externalIds.length,
    skipped: externalIds.length - total,
    attempted: total,
    succeeded,
    failed
  };
}

export async function runArchiveBackfill() {
  await ensureBootstrapSources();
  const activeSources = await listSources({ activeOnly: true });

  const results = [];
  for (const source of activeSources) {
    const externalIds = await scrapeSourceExternalIds(source);
    const existingIds = new Set(await findExistingExternalIds(source.id, externalIds));
    const stats = await ingestExternalIds(source, externalIds, {
      existingIds,
      concurrency: parsePositiveInt(process.env.ARCHIVE_BACKFILL_CONCURRENCY, DEFAULT_CONCURRENCY)
    });
    results.push({ sourceId: source.id, platform: source.platform, handle: source.handle, ...stats });
  }

  return results;
}

export async function runChannelMonitor() {
  await ensureBootstrapSources();
  const activeSources = await listSources({ activeOnly: true });

  for (const source of activeSources) {
    const externalIds = await scrapeSourceExternalIds(source);
    const existingIds = new Set(await findAllExternalIdsForSource(source.id));
    await ingestExternalIds(source, externalIds, {
      existingIds,
      concurrency: parsePositiveInt(process.env.ARCHIVE_MONITOR_CONCURRENCY, DEFAULT_CONCURRENCY)
    });
  }
}
