import { Router } from 'express';
import { syncVimeoArchive } from '../services/ingestService.js';
import { deleteVideoById, getVideoById, listVideos } from '../repositories/videoRepository.js';
import { readBoolean, readOptionalInteger } from '../config/env.js';

const router = Router();
const DEV_VERBOSE_ERRORS = process.env.NODE_ENV !== 'production';

function logRouteError(route, error) {
  if (DEV_VERBOSE_ERRORS) {
    console.error({ scope: 'api', route, message: error?.message || 'Unknown error', status: error?.status });
  }
}

function buildSnippet(video, query, radius = 90) {
  const haystack = video.transcriptText || video.description || video.title || '';
  if (!query) return haystack.slice(0, radius * 2);
  const index = haystack.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return haystack.slice(0, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(haystack.length, index + query.length + radius);
  return `${start > 0 ? '…' : ''}${haystack.slice(start, end).trim()}${end < haystack.length ? '…' : ''}`;
}

router.post('/vimeo/sync', async (req, res) => {
  try {
    const limit = req.body?.limit ? Number.parseInt(req.body.limit, 10) : readOptionalInteger(process.env.VIMEO_SYNC_LIMIT);
    const force = req.body?.force === undefined ? readBoolean(process.env.VIMEO_FORCE_REFRESH, false) : Boolean(req.body.force);
    const summary = await syncVimeoArchive({ limit, force });
    return res.json(summary);
  } catch (error) {
    logRouteError('/api/vimeo/sync', error);
    return res.status(error.status || 500).json({ error: error.message || 'Failed to sync Vimeo archive.' });
  }
});

router.get('/videos', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const videos = await listVideos({ q });
    return res.json(videos.map((video) => ({
      id: video.id,
      platform: video.platform,
      externalId: video.externalId,
      uri: video.uri,
      url: video.url,
      title: video.title,
      description: video.description,
      durationSeconds: video.durationSeconds,
      createdTime: video.createdTime,
      modifiedTime: video.modifiedTime,
      fetchedAt: video.fetchedAt,
      textTrackStatus: video.textTrackStatus,
      ingestStatus: video.ingestStatus,
      ingestError: video.ingestError,
      preview: buildSnippet(video, q)
    })));
  } catch (error) {
    logRouteError('/api/videos', error);
    return res.status(500).json({ error: 'Failed to load videos.' });
  }
});

router.get('/videos/:id', async (req, res) => {
  try {
    const video = await getVideoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });
    return res.json(video);
  } catch (error) {
    logRouteError('/api/videos/:id', error);
    return res.status(500).json({ error: 'Failed to load video.' });
  }
});

router.delete('/videos/:id', async (req, res) => {
  try {
    const deleted = await deleteVideoById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Video not found.' });
    return res.json({ ok: true });
  } catch (error) {
    logRouteError('/api/videos/:id DELETE', error);
    return res.status(500).json({ error: 'Failed to delete video.' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) return res.json([]);
    const videos = await listVideos({ q });
    return res.json(videos.map((video) => ({
      id: video.id,
      title: video.title,
      url: video.url,
      textTrackStatus: video.textTrackStatus,
      ingestStatus: video.ingestStatus,
      snippet: buildSnippet(video, q)
    })));
  } catch (error) {
    logRouteError('/api/search', error);
    return res.status(500).json({ error: 'Failed to search videos.' });
  }
});

export default router;
