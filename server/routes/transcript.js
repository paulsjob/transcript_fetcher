import { Router } from 'express';
import { fetchAndStoreTranscript } from '../services/transcriptService.js';
import { deleteTranscriptById, getTranscriptById } from '../repositories/transcriptRepository.js';
import { queryArchive } from '../repositories/archiveQueryRepository.js';
import { isValidVimeoUrl } from '../utils/validate.js';

const router = Router();
const DEV_VERBOSE_ERRORS =
  process.env.NODE_ENV !== 'production' || process.env.TRANSCRIPT_DEBUG === '1';

function buildSnippet(text, query, radius = 90) {
  if (!text) {
    return '';
  }

  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const matchIndex = normalizedText.indexOf(normalizedQuery);

  if (matchIndex === -1) {
    const preview = text.slice(0, radius * 2).trim();
    return preview.length < text.length ? `${preview}…` : preview;
  }

  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + query.length + radius);
  const snippet = text.slice(start, end).trim();

  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';

  return `${prefix}${snippet}${suffix}`;
}

function parseArchiveFilters(req) {
  return {
    q: typeof req.query.q === 'string' ? req.query.q.trim() : '',
    sortBy: req.query.sortBy === 'title' ? 'title' : 'fetchedAt',
    sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc'
  };
}

function logRouteError(route, error, extras = {}) {
  if (!DEV_VERBOSE_ERRORS) {
    return;
  }

  console.error({
    scope: 'api',
    route,
    message: error?.message || 'Unknown error',
    code: error?.code,
    name: error?.name,
    meta: error?.meta,
    details: error?.details,
    ...extras
  });
}

router.get('/search', async (req, res) => {
  const filters = parseArchiveFilters(req);

  if (!filters.q) {
    return res.json([]);
  }

  try {
    const records = await queryArchive(filters);
    const payload = records.map((record) => ({
      id: record.id,
      videoId: record.videoId,
      title: record.title,
      fetchedAt: record.fetchedAt,
      durationSeconds: record.durationSeconds,
      ingestStatus: record.ingestStatus,
      analysisStatus: record.analysisStatus || null,
      synopsis: record.synopsis || '',
      snippet: buildSnippet(record.transcriptText || record.synopsis || record.title, filters.q),
      matchQuery: filters.q,
      matchedFields: []
    }));

    return res.json(payload);
  } catch (error) {
    logRouteError('/api/search', error, { query: filters.q });
    return res.status(500).json({ error: 'Failed to search transcripts.' });
  }
});

router.get('/transcripts', async (req, res) => {
  const filters = parseArchiveFilters(req);

  try {
    const records = await queryArchive(filters);
    const payload = records.map((record) => ({
      id: record.id,
      videoId: record.videoId,
      title: record.title,
      fetchedAt: record.fetchedAt,
      durationSeconds: record.durationSeconds,
      ingestStatus: record.ingestStatus,
      ingestError: record.ingestError,
      analysisStatus: record.analysisStatus || null,
      synopsis: record.synopsis || '',
      keyPoints: record.keyPoints || [],
      preview: buildSnippet(record.transcriptText, filters.q, 70)
    }));

    return res.json(payload);
  } catch (error) {
    logRouteError('/api/transcripts', error, { filters });
    return res.status(500).json({ error: 'Failed to load transcript library.' });
  }
});

router.get('/transcripts/:id', async (req, res) => {
  try {
    const record = await getTranscriptById(req.params.id);

    if (!record) {
      return res.status(404).json({ error: 'Transcript not found.' });
    }

    return res.json(record);
  } catch (error) {
    logRouteError('/api/transcripts/:id', error, { id: req.params.id });
    return res.status(500).json({ error: 'Failed to load transcript.' });
  }
});

router.delete('/transcripts/:id', async (req, res) => {
  try {
    const deleted = await deleteTranscriptById(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Transcript not found.' });
    }

    return res.json({ ok: true });
  } catch (error) {
    logRouteError('/api/transcripts/:id DELETE', error, { id: req.params.id });
    return res.status(500).json({ error: 'Failed to delete transcript.' });
  }
});

router.post('/fetch-transcript', async (req, res) => {
  const videoUrl = req.body?.url;

  if (!videoUrl || typeof videoUrl !== 'string') {
    return res.status(400).json({ error: 'A Vimeo URL is required.' });
  }

  if (!isValidVimeoUrl(videoUrl)) {
    return res.status(400).json({ error: 'Please provide a valid Vimeo video URL.' });
  }

  try {
    const result = await fetchAndStoreTranscript(videoUrl.trim());
    return res.json(result);
  } catch (error) {
    logRouteError('/api/fetch-transcript', error, { videoUrl: videoUrl.trim() });
    if (error?.statusCode === 404) {
      return res.status(404).json(error.payload || { error: 'No subtitles available for this video' });
    }

    const response = { error: error.message || 'Failed to fetch transcript.' };
    if (DEV_VERBOSE_ERRORS && error?.details) {
      response.details = error.details;
    }

    return res.status(500).json(response);
  }
});

export default router;
