import ytDlp from 'yt-dlp-exec';
import {
  findAllVideoIds,
  findExistingVideoIds
} from '../repositories/transcriptRepository.js';
import { fetchAndStoreTranscriptByVideoId } from './transcriptService.js';

const DEFAULT_CONCURRENCY = 1;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function classifySourceUrl(url) {
  if (!url) {
    return 'missing';
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('vimeo.com')) {
      return 'unsupported_domain';
    }

    const path = parsed.pathname.toLowerCase();
    if (
      path.startsWith('/channels/') ||
      path.startsWith('/showcase/') ||
      path.startsWith('/ondemand/') ||
      path.startsWith('/album/') ||
      path.includes('/videos') ||
      /^\/\d+/.test(path) ||
      path.split('/').filter(Boolean).length === 1
    ) {
      return 'supported';
    }

    return 'unknown_vimeo_path';
  } catch {
    return 'invalid_url';
  }
}

function getMonitorSourceUrl() {
  return (
    process.env.VIMEO_ARCHIVE_URL?.trim() ||
    process.env.VIMEO_CHANNEL_URL?.trim() ||
    ''
  );
}

async function scrapeSourceVideoIds(sourceUrl) {
  const sourceType = classifySourceUrl(sourceUrl);

  if (sourceType === 'missing') {
    const error = new Error(
      'No Vimeo archive source URL configured. Set VIMEO_ARCHIVE_URL (preferred) or VIMEO_CHANNEL_URL.'
    );
    error.code = 'MISSING_SOURCE_URL';
    throw error;
  }

  if (sourceType === 'unsupported_domain' || sourceType === 'invalid_url') {
    const error = new Error(
      `Unsupported archive source URL: "${sourceUrl}". Expected a valid Vimeo channel/showcase/user/videos URL.`
    );
    error.code = 'UNSUPPORTED_SOURCE_URL';
    throw error;
  }

  const jsonOutput = await ytDlp(sourceUrl, {
    flatPlaylist: true,
    dumpSingleJson: true,
    skipDownload: true,
    noWarnings: true,
    noCallHome: true
  });

  const parsed = typeof jsonOutput === 'string' ? JSON.parse(jsonOutput) : jsonOutput;
  const playlistEntries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  const playlistVideoIds = playlistEntries
    .map((entry) => entry?.id)
    .filter((id) => typeof id === 'string' && id.trim().length > 0);

  if (playlistVideoIds.length > 0) {
    return [...new Set(playlistVideoIds)];
  }

  if (typeof parsed?.id === 'string' && parsed.id.trim().length > 0) {
    return [parsed.id.trim()];
  }

  const error = new Error(
    `No Vimeo video IDs were found for source ${sourceUrl}. Verify the URL points to a public archive/channel/showcase.`
  );
  error.code = 'NO_VIDEO_IDS_FOUND';
  throw error;
}

async function ingestVideoIds(videoIds, options = {}) {
  const {
    existingIds = new Set(),
    context = 'monitor',
    concurrency = DEFAULT_CONCURRENCY
  } = options;

  const pendingVideoIds = videoIds.filter((videoId) => !existingIds.has(videoId));

  console.log(
    `[${context}] discovered=${videoIds.length} alreadyIngested=${videoIds.length - pendingVideoIds.length} newToIngest=${pendingVideoIds.length}`
  );

  if (!pendingVideoIds.length) {
    console.log(`[${context}] Nothing new to ingest.`);
    return {
      discovered: videoIds.length,
      skipped: videoIds.length,
      attempted: 0,
      succeeded: 0,
      failed: 0
    };
  }

  const total = pendingVideoIds.length;
  let index = 0;
  let succeeded = 0;
  let failed = 0;

  const workerCount = Math.min(parsePositiveInt(concurrency, DEFAULT_CONCURRENCY), total);

  async function worker(workerIndex) {
    while (index < total) {
      const currentIndex = index;
      index += 1;
      const videoId = pendingVideoIds[currentIndex];
      const progress = `${currentIndex + 1}/${total}`;

      console.log(`[${context}] [worker ${workerIndex}] ingest.start ${progress} videoId=${videoId}`);

      try {
        await fetchAndStoreTranscriptByVideoId(videoId);
        succeeded += 1;
        console.log(`[${context}] [worker ${workerIndex}] ingest.success ${progress} videoId=${videoId}`);
      } catch (error) {
        failed += 1;
        console.error(
          `[${context}] [worker ${workerIndex}] ingest.failed ${progress} videoId=${videoId}:`,
          error?.message || error
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, (_, i) => worker(i + 1))
  );

  console.log(
    `[${context}] complete discovered=${videoIds.length} skipped=${videoIds.length - pendingVideoIds.length} attempted=${total} succeeded=${succeeded} failed=${failed}`
  );

  return {
    discovered: videoIds.length,
    skipped: videoIds.length - pendingVideoIds.length,
    attempted: total,
    succeeded,
    failed
  };
}

export async function runArchiveBackfill() {
  const sourceUrl = getMonitorSourceUrl();
  const videoIds = await scrapeSourceVideoIds(sourceUrl);
  const existingIds = new Set(await findExistingVideoIds(videoIds));
  const concurrency = parsePositiveInt(process.env.ARCHIVE_BACKFILL_CONCURRENCY, DEFAULT_CONCURRENCY);

  return ingestVideoIds(videoIds, {
    existingIds,
    context: 'archive-backfill',
    concurrency
  });
}

export async function runChannelMonitor(channelUrl = getMonitorSourceUrl()) {
  if (!channelUrl) {
    console.log('Cron monitor skipped: VIMEO_ARCHIVE_URL/VIMEO_CHANNEL_URL is empty.');
    return;
  }

  const channelVideoIds = await scrapeSourceVideoIds(channelUrl);
  const existingIds = new Set(await findAllVideoIds());

  await ingestVideoIds(channelVideoIds, {
    existingIds,
    context: 'cron-monitor',
    concurrency: parsePositiveInt(process.env.ARCHIVE_MONITOR_CONCURRENCY, DEFAULT_CONCURRENCY)
  });
}
