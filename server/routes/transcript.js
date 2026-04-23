import { Router } from 'express';
import { fetchAndStoreTranscript } from '../services/transcriptService.js';
import { deleteContentById, getContentById, queryContentLibrary } from '../repositories/contentRepository.js';
import { ensureSource, listSources, updateSource } from '../repositories/sourceRepository.js';

const router = Router();
const DEV_VERBOSE_ERRORS = process.env.NODE_ENV !== 'production' || process.env.TRANSCRIPT_DEBUG === '1';

function buildSnippet(text, query, radius = 90) {
  if (!text) return '';
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const matchIndex = normalizedText.indexOf(normalizedQuery);
  if (matchIndex === -1) {
    const preview = text.slice(0, radius * 2).trim();
    return preview.length < text.length ? `${preview}…` : preview;
  }
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + query.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

function parseArchiveFilters(req) {
  return {
    q: typeof req.query.q === 'string' ? req.query.q.trim() : '',
    sortBy: ['title', 'publishedAt', 'fetchedAt'].includes(req.query.sortBy) ? req.query.sortBy : 'fetchedAt',
    sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    platform: typeof req.query.platform === 'string' ? req.query.platform.trim().toLowerCase() : 'any',
    sourceId: typeof req.query.sourceId === 'string' ? req.query.sourceId.trim() : 'any'
  };
}

function logRouteError(route, error, extras = {}) {
  if (!DEV_VERBOSE_ERRORS) return;
  console.error({ scope: 'api', route, message: error?.message || 'Unknown error', code: error?.code, details: error?.details, ...extras });
}

router.get('/sources', async (_req, res) => {
  try {
    const sources = await listSources();
    return res.json(sources);
  } catch (error) {
    logRouteError('/api/sources', error);
    return res.status(500).json({ error: 'Failed to load sources.' });
  }
});

router.post('/sources', async (req, res) => {
  const { platform, handle, displayName, sourceUrl, isActive = true, ingestSettings = {} } = req.body || {};
  if (!platform || !handle || !displayName || !sourceUrl) {
    return res.status(400).json({ error: 'platform, handle, displayName, and sourceUrl are required.' });
  }

  try {
    const source = await ensureSource({ platform, handle, displayName, sourceUrl, isActive, ingestSettings });
    return res.status(201).json(source);
  } catch (error) {
    logRouteError('/api/sources POST', error);
    return res.status(500).json({ error: 'Failed to save source.' });
  }
});

router.patch('/sources/:id', async (req, res) => {
  try {
    const source = await updateSource(req.params.id, req.body || {});
    return res.json(source);
  } catch (error) {
    logRouteError('/api/sources/:id PATCH', error, { id: req.params.id });
    return res.status(500).json({ error: 'Failed to update source.' });
  }
});

router.get('/search', async (req, res) => {
  const filters = parseArchiveFilters(req);
  if (!filters.q) return res.json([]);

  try {
    const records = await queryContentLibrary(filters);
    return res.json(records.map((record) => ({
      id: record.id,
      externalContentId: record.externalContentId,
      title: record.title,
      fetchedAt: record.fetchedAt,
      publishedAt: record.publishedAt,
      platform: record.platform,
      sourceId: record.sourceId,
      source: record.source,
      synopsis: record.synopsis || '',
      snippet: buildSnippet(record.transcriptText || record.bodyText || record.synopsis || record.title, filters.q)
    })));
  } catch (error) {
    logRouteError('/api/search', error, { query: filters.q });
    return res.status(500).json({ error: 'Failed to search archive.' });
  }
});

router.get('/transcripts', async (req, res) => {
  const filters = parseArchiveFilters(req);

  try {
    const records = await queryContentLibrary(filters);
    const payload = records.map((record) => ({
      id: record.id,
      videoId: record.externalContentId,
      externalContentId: record.externalContentId,
      sourceId: record.sourceId,
      source: record.source,
      platform: record.platform,
      contentType: record.contentType,
      title: record.title,
      fetchedAt: record.fetchedAt,
      publishedAt: record.publishedAt,
      durationSeconds: record.durationSeconds,
      ingestStatus: record.ingestStatus,
      ingestError: record.ingestError,
      analysisStatus: record.analysisStatus || null,
      synopsis: record.synopsis || '',
      keyPoints: record.keyPoints || [],
      preview: buildSnippet(record.transcriptText || record.bodyText, filters.q, 70)
    }));

    return res.json(payload);
  } catch (error) {
    logRouteError('/api/transcripts', error, { filters });
    return res.status(500).json({ error: 'Failed to load archive library.' });
  }
});

router.get('/transcripts/:id', async (req, res) => {
  try {
    const record = await getContentById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Content item not found.' });
    return res.json(record);
  } catch (error) {
    logRouteError('/api/transcripts/:id', error, { id: req.params.id });
    return res.status(500).json({ error: 'Failed to load content item.' });
  }
});

router.delete('/transcripts/:id', async (req, res) => {
  try {
    const deleted = await deleteContentById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Content item not found.' });
    return res.json({ ok: true });
  } catch (error) {
    logRouteError('/api/transcripts/:id DELETE', error, { id: req.params.id });
    return res.status(500).json({ error: 'Failed to delete content item.' });
  }
});

router.post('/fetch-transcript', async (req, res) => {
  const mediaUrl = req.body?.url;
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return res.status(400).json({ error: 'A media URL is required.' });
  }

  try {
    const result = await fetchAndStoreTranscript(mediaUrl.trim());
    return res.json(result);
  } catch (error) {
    logRouteError('/api/fetch-transcript', error, { mediaUrl: mediaUrl.trim() });
    if (error?.statusCode === 404) {
      return res.status(404).json(error.payload || { error: 'No subtitles available for this content item' });
    }

    const response = { error: error.message || 'Failed to fetch transcript.' };
    if (DEV_VERBOSE_ERRORS && error?.details) {
      response.details = error.details;
    }
    return res.status(500).json(response);
  }
});

export default router;
