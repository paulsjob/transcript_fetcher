import { Router } from 'express';
import { fetchAndStoreTranscript } from '../services/transcriptService.js';
import {
  deleteTranscriptById,
  getTranscriptById,
  listTranscripts,
  searchTranscripts
} from '../repositories/transcriptRepository.js';
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

function safeParseTranscriptEntries(transcriptJson) {
  if (Array.isArray(transcriptJson)) {
    return transcriptJson;
  }

  if (typeof transcriptJson !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(transcriptJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractMatchText(text, query) {
  if (!text || !query) {
    return query || '';
  }

  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const index = normalizedText.indexOf(normalizedQuery);

  if (index === -1) {
    return query;
  }

  return text.slice(index, index + query.length);
}

function deriveMatchMetadata(record, query) {
  const entries = safeParseTranscriptEntries(record.transcriptJson);
  const normalizedQuery = query.toLowerCase();

  for (let index = 0; index < entries.length; index += 1) {
    const lineText = typeof entries[index]?.text === 'string' ? entries[index].text : '';
    if (!lineText.toLowerCase().includes(normalizedQuery)) {
      continue;
    }

    return {
      snippet: buildSnippet(lineText, query),
      matchText: extractMatchText(lineText, query),
      bestLineIndex: index,
      bestTimestamp: entries[index]?.timestamp || null,
      matchSource: 'transcriptJson'
    };
  }

  const fallbackSnippet = buildSnippet(record.transcriptText || record.title || '', query);
  const fallbackText = extractMatchText(record.transcriptText || record.title || '', query);

  return {
    snippet: fallbackSnippet,
    matchText: fallbackText,
    bestLineIndex: null,
    bestTimestamp: null,
    matchSource: entries.length ? 'transcriptJson-unmatched' : 'transcriptText'
  };
}

router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (!q) {
    return res.json([]);
  }

  try {
    const records = await searchTranscripts(q);
    const payload = records.map((record) => {
      const metadata = deriveMatchMetadata(record, q);

      return {
        id: record.id,
        videoId: record.videoId,
        title: record.title,
        snippet: metadata.snippet,
        synopsis: record.synopsis || '',
        themes: record.themes || [],
        tags: record.tags || [],
        matchQuery: q,
        matchText: metadata.matchText,
        bestLineIndex: metadata.bestLineIndex,
        bestTimestamp: metadata.bestTimestamp,
        matchSource: metadata.matchSource
      };
    });

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
      durationSeconds: record.durationSeconds,
      analysisStatus: record.analysisStatus || null,
      synopsis: record.synopsis || '',
      themes: record.themes || [],
      tags: record.tags || [],
      keyPoints: record.keyPoints || [],
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

router.delete('/transcripts/:id', async (req, res) => {
  try {
    const deleted = await deleteTranscriptById(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Transcript not found.' });
    }

    return res.json({ ok: true });
  } catch (error) {
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
