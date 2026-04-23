import { Router } from 'express';
import { fetchAndStoreTranscript } from '../services/transcriptService.js';
import { isValidVimeoUrl } from '../utils/validate.js';

const router = Router();

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
    return res.status(500).json({ error: error.message || 'Failed to fetch transcript.' });
  }
});

export default router;
