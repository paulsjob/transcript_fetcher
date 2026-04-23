import { Router } from 'express';
import { fetchAndStoreTranscript } from '../services/transcriptService.js';
import { getTranscriptById, listTranscripts, searchTranscripts } from '../repositories/transcriptRepository.js';
import { isValidVimeoUrl } from '../utils/validate.js';

const router = Router();
const DEV_VERBOSE_ERRORS =
  process.env.NODE_ENV !== 'production' || process.env.TRANSCRIPT_DEBUG === '1';

function buildSnippet(text, query, radius = 90) {
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

router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (!q) {
    return res.json([]);
  }

  try {
    const records = await searchTranscripts(q);
    const payload = records.map((record) => ({
      id: record.id,
      videoId: record.videoId,
      title: record.title,
      snippet: buildSnippet(record.transcriptText, q)
    }));

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to search transcripts.' });
  }
});

router.get('/transcripts', async (_req, res) => {
  try {
    const records = await listTranscripts();
    const payload = records.map((record) => ({
      id: record.id,
      videoId: record.videoId,
      title: record.title,
      fetchedAt: record.fetchedAt,
      preview: buildSnippet(record.transcriptText, '', 70)
    }));

    return res.json(payload);
  } catch (error) {
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
    return res.status(500).json({ error: 'Failed to load transcript.' });
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
