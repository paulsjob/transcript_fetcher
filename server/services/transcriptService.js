import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ytDlp from 'yt-dlp-exec';
import { parseVttToTranscript } from '../utils/parseVtt.js';
import { upsertTranscript } from '../repositories/transcriptRepository.js';

function mapYtDlpError(error = null) {
  const stderr = (error?.stderr || error?.message || '').toString().toLowerCase();

  if (stderr.includes('unsupported url')) {
    return 'Unsupported video URL.';
  }

  if (stderr.includes('subtitles') || stderr.includes('no subtitles')) {
    return 'No subtitles were found for this video.';
  }

  return 'Failed to fetch transcript with yt-dlp.';
}

function createNoTranscriptError() {
  const error = new Error('No transcript available for this video.');
  error.statusCode = 404;
  return error;
}

async function getVideoMetadata(videoUrl) {
  const jsonOutput = await ytDlp(videoUrl, {
    dumpSingleJson: true,
    skipDownload: true,
    noWarnings: true,
    noCallHome: true
  });

  const parsed = JSON.parse(jsonOutput);
  return {
    id: parsed.id,
    title: parsed.title || 'Untitled Vimeo Video'
  };
}

async function extractTranscript(videoUrl) {
  const workdir = await mkdtemp(path.join(tmpdir(), 'vimeo-transcript-'));
  const outputTemplate = path.join(workdir, 'transcript.%(ext)s');

  try {
    try {
      await ytDlp(videoUrl, {
        writeAutoSubs: true,
        writeSubs: true,
        subFormat: 'vtt',
        skipDownload: true,
        noPlaylist: true,
        output: outputTemplate
      });
    } catch (error) {
      throw createNoTranscriptError();
    }

    const files = await readdir(workdir);
    const vttFile = files.find((file) => file.endsWith('.vtt'));

    if (!vttFile) {
      throw createNoTranscriptError();
    }

    const vttFilePath = path.join(workdir, vttFile);
    if (!existsSync(vttFilePath)) {
      throw createNoTranscriptError();
    }

    const vttContent = await readFile(vttFilePath, 'utf-8');
    const transcript = parseVttToTranscript(vttContent);

    if (!transcript.length) {
      throw createNoTranscriptError();
    }

    return transcript;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

export async function fetchAndStoreTranscript(videoUrl) {
  try {
    const metadata = await getVideoMetadata(videoUrl);
    const transcript = await extractTranscript(videoUrl);

    await upsertTranscript({
      videoId: metadata.id,
      title: metadata.title,
      transcript
    });

    return {
      videoId: metadata.id,
      title: metadata.title,
      transcript
    };
  } catch (error) {
    if (error?.statusCode === 404) {
      throw error;
    }

    if (error?.stderr || error?.message) {
      throw new Error(mapYtDlpError(error));
    }

    throw error;
  }
}

export async function fetchAndStoreTranscriptByVideoId(videoId) {
  return fetchAndStoreTranscript(`https://vimeo.com/${videoId}`);
}
