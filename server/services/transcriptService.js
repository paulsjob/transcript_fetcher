import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseVttToTranscript } from '../utils/parseVtt.js';

const execFileAsync = promisify(execFile);

function mapYtDlpError(stderr = '') {
  const lowerStderr = stderr.toLowerCase();

  if (lowerStderr.includes('unsupported url')) {
    return 'Unsupported video URL.';
  }

  if (lowerStderr.includes('subtitles') || lowerStderr.includes('no subtitles')) {
    return 'No subtitles were found for this video.';
  }

  return 'Failed to fetch transcript with yt-dlp.';
}

export async function fetchTranscriptFromVimeo(videoUrl) {
  const workdir = await mkdtemp(path.join(tmpdir(), 'vimeo-transcript-'));
  const outputTemplate = path.join(workdir, 'transcript.%(ext)s');

  try {
    await execFileAsync('yt-dlp', [
      '--write-auto-subs',
      '--write-subs',
      '--sub-format',
      'vtt',
      '--skip-download',
      '--no-playlist',
      '--output',
      outputTemplate,
      videoUrl
    ]);

    const files = await readdir(workdir);
    const vttFile = files.find((file) => file.endsWith('.vtt'));

    if (!vttFile) {
      throw new Error('No subtitles were found for this video.');
    }

    const vttContent = await readFile(path.join(workdir, vttFile), 'utf-8');
    const transcript = parseVttToTranscript(vttContent);

    if (!transcript.length) {
      throw new Error('Subtitles were found, but no readable transcript lines were parsed.');
    }

    return transcript;
  } catch (error) {
    if (error.stderr) {
      throw new Error(mapYtDlpError(error.stderr));
    }

    throw error;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
