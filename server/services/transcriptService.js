import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ytDlp from 'yt-dlp-exec';
import { parseVttToTranscript } from '../utils/parseVtt.js';
import { markNoSubtitles, upsertTranscript } from '../repositories/transcriptRepository.js';
import { analyzeTranscript } from './transcriptAnalysisService.js';

const DEV_VERBOSE_ERRORS =
  process.env.NODE_ENV !== 'production' || process.env.TRANSCRIPT_DEBUG === '1';

function logTranscriptEvent(event, context = {}, level = 'info') {
  const payload = { scope: 'transcript-fetch', event, ...context };

  if (level === 'error') {
    console.error(payload);
    return;
  }

  console.log(payload);
}

function normalizeErrorText(error = null) {
  return `${error?.stderr || ''}\n${error?.message || ''}`.toLowerCase();
}

function classifyYtDlpError(error = null) {
  const details = normalizeErrorText(error);

  if (
    error?.code === 'ENOENT' ||
    details.includes('spawn') ||
    details.includes('enoent')
  ) {
    return {
      type: 'missing_binary',
      message:
        'yt-dlp executable is unavailable. Install yt-dlp on your system or set YT_DLP_PATH to a valid binary path.'
    };
  }

  if (
    details.includes('private') ||
    details.includes('password') ||
    details.includes('login required') ||
    details.includes('forbidden') ||
    details.includes('http error 403')
  ) {
    return {
      type: 'restricted_video',
      message: 'Video is private or restricted; subtitles could not be accessed.'
    };
  }

  if (
    details.includes('no subtitles') ||
    details.includes('no automatic captions') ||
    details.includes('subtitles are not available')
  ) {
    return {
      type: 'no_subtitles',
      message: 'No subtitles were found for this video.'
    };
  }

  if (details.includes('unsupported url')) {
    return { type: 'unsupported_url', message: 'Unsupported video URL.' };
  }

  return {
    type: 'extract_failed',
    message: 'Failed to fetch transcript with yt-dlp.'
  };
}

function createInternalError(message, details = null) {
  const error = new Error(message);
  error.statusCode = 500;
  if (details) {
    error.details = details;
  }
  return error;
}

function createNoTranscriptError() {
  const error = new Error('No subtitles available for this video');
  error.statusCode = 404;
  error.payload = { error: 'No subtitles available for this video' };
  return error;
}

async function getVideoMetadata(videoUrl) {
  logTranscriptEvent('metadata.fetch.start', { videoUrl });

  const jsonOutput = await runYtDlp(videoUrl, {
    dumpSingleJson: true,
    skipDownload: true,
    noWarnings: true,
    noCallHome: true
  });
  const parsed = typeof jsonOutput === 'string' ? JSON.parse(jsonOutput) : jsonOutput;

  const metadata = {
    id: parsed.id,
    title: parsed.title || 'Untitled Vimeo Video',
    durationSeconds: Number.isFinite(parsed.duration) ? Math.round(parsed.duration) : null
  };

  logTranscriptEvent('metadata.fetch.success', {
    videoId: metadata.id,
    title: metadata.title,
    durationSeconds: metadata.durationSeconds
  });

  return metadata;
}

const ytDlpRunners = [
  { name: 'package_binary', runner: ytDlp },
  { name: 'system_binary', runner: ytDlp.create(process.env.YT_DLP_PATH || 'yt-dlp') }
];

async function runYtDlp(url, options) {
  let lastError = null;

  for (const candidate of ytDlpRunners) {
    try {
      return await candidate.runner(url, options);
    } catch (error) {
      lastError = error;
      const classification = classifyYtDlpError(error);
      logTranscriptEvent(
        'ytdlp.exec.failed',
        {
          candidate: candidate.name,
          type: classification.type,
          message: error?.message || '',
          stderr: DEV_VERBOSE_ERRORS ? error?.stderr?.toString() || '' : undefined
        },
        'error'
      );

      if (classification.type !== 'missing_binary') {
        throw error;
      }
    }
  }

  throw lastError || createInternalError('Failed to run yt-dlp.');
}

async function extractTranscript(videoUrl, videoId) {
  const workdir = await mkdtemp(path.join(tmpdir(), 'vimeo-transcript-'));
  const outputTemplate = path.join(workdir, '%(id)s.%(ext)s');

  const ytDlpOptions = {
    writeAutoSubs: true,
    writeSubs: true,
    subLangs: 'en.*,en,all,-live_chat',
    subFormat: 'vtt',
    skipDownload: true,
    noPlaylist: true,
    output: outputTemplate
  };

  try {
    logTranscriptEvent('subtitles.fetch.start', { videoUrl, videoId, workdir });
    await runYtDlp(videoUrl, ytDlpOptions);
    logTranscriptEvent('subtitles.fetch.success', { videoId });

    const files = readdirSync(workdir);
    const vttFile = files.find(
      (file) => file.startsWith(`${videoId}.`) && file.endsWith('.vtt')
    );
    logTranscriptEvent('subtitles.vtt.detected', {
      videoId,
      files,
      vttFile: vttFile || null
    });

    if (!vttFile) {
      throw createNoTranscriptError();
    }

    const vttFilePath = path.join(workdir, vttFile);
    if (!existsSync(vttFilePath)) {
      throw createNoTranscriptError();
    }

    let transcript = [];
    try {
      const vttContent = await readFile(vttFilePath, 'utf-8');
      logTranscriptEvent('subtitles.vtt.parse.start', { videoId, vttFile });
      transcript = parseVttToTranscript(vttContent);
      logTranscriptEvent('subtitles.vtt.parse.success', {
        videoId,
        segments: transcript.length
      });
    } finally {
      await rm(vttFilePath, { force: true });
    }

    if (!transcript.length) {
      throw createNoTranscriptError();
    }

    return transcript;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

export async function fetchAndStoreTranscript(videoUrl) {
  let metadata = null;

  try {
    metadata = await getVideoMetadata(videoUrl);
    const transcript = await extractTranscript(videoUrl, metadata.id);
    const transcriptText = transcript.map((entry) => entry.text).join(' ').trim();

    let analysis = null;
    try {
      analysis = await analyzeTranscript({
        title: metadata.title,
        durationSeconds: metadata.durationSeconds,
        transcript,
        transcriptText
      });
      logTranscriptEvent('analysis.complete', {
        videoId: metadata.id,
        status: analysis.analysisStatus,
        version: analysis.analysisVersion
      });
    } catch (analysisError) {
      logTranscriptEvent(
        'analysis.failed',
        {
          videoId: metadata.id,
          message: analysisError?.message || 'Unknown analysis error'
        },
        'error'
      );
      analysis = {
        analysisStatus: 'failed',
        analysisVersion: null,
        analyzedAt: new Date(),
        synopsis: null,
        keyPoints: [],
        entities: { people: [], organizations: [], places: [], programs: [], issues: [] },
        tags: [],
        sections: [],
        notableQuotes: []
      };
    }

    logTranscriptEvent('db.upsert.start', {
      videoId: metadata.id,
      title: metadata.title,
      durationSeconds: metadata.durationSeconds,
      segments: transcript.length,
      analysisStatus: analysis?.analysisStatus || null
    });
    await upsertTranscript({
      videoId: metadata.id,
      title: metadata.title,
      durationSeconds: metadata.durationSeconds,
      transcript,
      analysis,
      ingestStatus: 'completed',
      ingestError: null
    });
    logTranscriptEvent('db.upsert.success', { videoId: metadata.id });

    return {
      videoId: metadata.id,
      title: metadata.title,
      durationSeconds: metadata.durationSeconds,
      transcript
    };
  } catch (error) {
    if (error?.statusCode === 404) {
      if (metadata?.id) {
        try {
          await markNoSubtitles({
            videoId: metadata.id,
            title: metadata.title,
            durationSeconds: metadata.durationSeconds,
            message: error?.payload?.error || error.message
          });
          logTranscriptEvent('db.mark_no_subtitles.success', { videoId: metadata.id });
        } catch (markError) {
          logTranscriptEvent(
            'db.mark_no_subtitles.failed',
            {
              videoId: metadata.id,
              message: markError?.message || 'Failed to persist no-subtitles marker'
            },
            'error'
          );
        }
      }
      throw error;
    }

    if (error?.code?.startsWith?.('P')) {
      logTranscriptEvent(
        'db.upsert.failed',
        { message: error.message, code: error.code },
        'error'
      );
      throw createInternalError('Failed to save transcript to the database.', {
        code: error.code,
        message: error.message
      });
    }

    const classification = classifyYtDlpError(error);

    if (classification.type === 'no_subtitles') {
      throw createNoTranscriptError();
    }

    if (classification.type === 'restricted_video') {
      throw createInternalError(classification.message, {
        type: classification.type,
        stderr: error?.stderr?.toString() || ''
      });
    }

    if (classification.type === 'missing_binary') {
      throw createInternalError(classification.message, {
        type: classification.type,
        hint: 'Install yt-dlp (https://github.com/yt-dlp/yt-dlp#installation) and ensure it is available on PATH.'
      });
    }

    if (error?.stderr || error?.message) {
      throw createInternalError(classification.message, {
        type: classification.type,
        stderr: error?.stderr?.toString() || '',
        message: error?.message || ''
      });
    }

    throw error;
  }
}

export async function fetchAndStoreTranscriptByVideoId(videoId) {
  return fetchAndStoreTranscript(`https://vimeo.com/${videoId}`);
}
