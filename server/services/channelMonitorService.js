import ytDlp from 'yt-dlp-exec';
import { findAllVideoIds } from '../repositories/transcriptRepository.js';
import { fetchAndStoreTranscriptByVideoId } from './transcriptService.js';

async function scrapeChannelVideoIds(channelUrl) {
  const jsonOutput = await ytDlp(channelUrl, {
    flatPlaylist: true,
    dumpSingleJson: true,
    skipDownload: true,
    noWarnings: true,
    noCallHome: true
  });

  const parsed = JSON.parse(jsonOutput);
  const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];

  return entries
    .map((entry) => entry?.id)
    .filter((id) => typeof id === 'string' && id.trim().length > 0);
}

export async function runChannelMonitor(channelUrl) {
  if (!channelUrl) {
    console.log('Cron monitor skipped: VIMEO_CHANNEL_URL is empty.');
    return;
  }

  const channelVideoIds = await scrapeChannelVideoIds(channelUrl);
  const existingIds = new Set(await findAllVideoIds());
  const newVideoIds = channelVideoIds.filter((videoId) => !existingIds.has(videoId));

  if (!newVideoIds.length) {
    console.log('Cron monitor complete: no new videos detected.');
    return;
  }

  console.log(`Cron monitor detected ${newVideoIds.length} new video(s).`);

  for (const videoId of newVideoIds) {
    try {
      await fetchAndStoreTranscriptByVideoId(videoId);
      console.log(`Archived transcript for Vimeo video ${videoId}.`);
    } catch (error) {
      console.error(`Failed to archive ${videoId}:`, error.message || error);
    }
  }
}
