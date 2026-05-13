import { readBoolean, readOptionalInteger } from '../config/env.js';
import { fetchAllVimeoVideos, fetchTextTrackFile, fetchVimeoTextTracks, extractVimeoVideoId } from './vimeo/vimeoClient.js';
import { parseVtt, pickBestEnglishTextTrack, transcriptTextFromSegments } from './transcript/textTrackService.js';
import { findVideoByExternalId, markVideoCompleted, markVideoFailed, markVideoNoSubtitles, upsertVideoMetadata } from '../repositories/videoRepository.js';

function toVideoMetadata(vimeoVideo) {
  return {
    externalId: extractVimeoVideoId(vimeoVideo),
    uri: vimeoVideo.uri || null,
    url: vimeoVideo.link || vimeoVideo.player_embed_url || null,
    title: vimeoVideo.name || 'Untitled Vimeo video',
    description: vimeoVideo.description || null,
    durationSeconds: Number.isFinite(vimeoVideo.duration) ? vimeoVideo.duration : null,
    createdTime: vimeoVideo.created_time || null,
    modifiedTime: vimeoVideo.modified_time || vimeoVideo.release_time || null,
    rawMetadata: vimeoVideo
  };
}

function hasUnchangedCompletedRecord(existing, metadata, force) {
  if (force || !existing) return false;
  if (existing.textTrackStatus !== 'completed' && existing.textTrackStatus !== 'no_subtitles') return false;
  const existingModified = existing.modifiedTime ? new Date(existing.modifiedTime).toISOString() : null;
  const incomingModified = metadata.modifiedTime ? new Date(metadata.modifiedTime).toISOString() : null;
  return existingModified === incomingModified;
}

function logProgress(message, details = {}) {
  console.log(`[vimeo-sync] ${message}`, details);
}

export async function syncVimeoArchive(options = {}) {
  const limit = options.limit ?? readOptionalInteger(process.env.VIMEO_SYNC_LIMIT);
  const force = options.force ?? readBoolean(process.env.VIMEO_FORCE_REFRESH, false);
  const summary = {
    discovered: 0,
    alreadyCompleted: 0,
    newlyProcessed: 0,
    noSubtitles: 0,
    failed: 0,
    videos: []
  };

  logProgress('Starting authenticated Vimeo archive sync.', { limit: limit || 'all', force });
  const vimeoVideos = await fetchAllVimeoVideos({ limit });
  summary.discovered = vimeoVideos.length;
  logProgress('Videos discovered.', { count: summary.discovered });

  for (const vimeoVideo of vimeoVideos) {
    const metadata = toVideoMetadata(vimeoVideo);
    if (!metadata.externalId) {
      summary.failed += 1;
      logProgress('Skipping Vimeo video without an external id.', { uri: metadata.uri });
      continue;
    }

    const existing = await findVideoByExternalId(metadata.externalId);
    const video = await upsertVideoMetadata(metadata);

    if (hasUnchangedCompletedRecord(existing, metadata, force)) {
      summary.alreadyCompleted += 1;
      summary.videos.push({ id: video.id, title: video.title, status: video.textTrackStatus, skipped: true });
      continue;
    }

    try {
      const tracks = await fetchVimeoTextTracks(vimeoVideo);
      const selectedTrack = pickBestEnglishTextTrack(tracks);

      if (!selectedTrack) {
        const updated = await markVideoNoSubtitles(video.id);
        summary.noSubtitles += 1;
        summary.videos.push({ id: updated.id, title: updated.title, status: updated.textTrackStatus });
        continue;
      }

      const textTrackFile = await fetchTextTrackFile(selectedTrack);
      const segments = parseVtt(textTrackFile);

      if (!segments.length) {
        const updated = await markVideoNoSubtitles(video.id);
        summary.noSubtitles += 1;
        summary.videos.push({ id: updated.id, title: updated.title, status: updated.textTrackStatus });
        continue;
      }

      const updated = await markVideoCompleted(video.id, segments, transcriptTextFromSegments(segments));
      summary.newlyProcessed += 1;
      summary.videos.push({ id: updated.id, title: updated.title, status: updated.textTrackStatus, segments: segments.length });
    } catch (error) {
      await markVideoFailed(video.id, error.message || 'Vimeo ingest failed.');
      summary.failed += 1;
      summary.videos.push({ id: video.id, title: video.title, status: 'failed', error: error.message || 'Vimeo ingest failed.' });
      logProgress('Video ingest failed.', { externalId: metadata.externalId, title: metadata.title, error: error.message });
    }
  }

  logProgress('Final summary.', summary);
  return summary;
}
