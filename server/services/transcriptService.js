import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ytDlp from 'yt-dlp-exec';
import { parseVttToTranscript } from '../utils/parseVtt.js';
import { markContentNoTranscript, upsertContentItem } from '../repositories/contentRepository.js';
import { ensureSource } from '../repositories/sourceRepository.js';
import { analyzeTranscript } from './transcriptAnalysisService.js';

const DEV_VERBOSE_ERRORS = process.env.NODE_ENV !== 'production' || process.env.TRANSCRIPT_DEBUG === '1';

function detectPlatformFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('vimeo.com')) return 'vimeo';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
  } catch {
    return 'unknown';
  }

  return 'unknown';
}

function classifyYtDlpError(error = null) {
  const details = `${error?.stderr || ''}\n${error?.message || ''}`.toLowerCase();
  if (error?.code === 'ENOENT' || details.includes('spawn') || details.includes('enoent')) {
    return { type: 'missing_binary', message: 'yt-dlp executable is unavailable.' };
  }
  if (details.includes('private') || details.includes('password') || details.includes('login required') || details.includes('forbidden') || details.includes('http error 403')) {
    return { type: 'restricted_video', message: 'Video is private or restricted.' };
  }
  if (details.includes('no subtitles') || details.includes('no automatic captions') || details.includes('subtitles are not available')) {
    return { type: 'no_subtitles', message: 'No subtitles were found for this item.' };
  }
  return { type: 'extract_failed', message: 'Failed to fetch transcript with yt-dlp.' };
}

function createNoTranscriptError() {
  const error = new Error('No subtitles available for this content item');
  error.statusCode = 404;
  error.payload = { error: 'No subtitles available for this content item' };
  return error;
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
      if (classification.type !== 'missing_binary') {
        throw error;
      }
    }
  }
  throw lastError || new Error('Failed to run yt-dlp.');
}

async function getContentMetadata(contentUrl) {
  const jsonOutput = await runYtDlp(contentUrl, {
    dumpSingleJson: true,
    skipDownload: true,
    noWarnings: true,
    noCallHome: true
  });
  const parsed = typeof jsonOutput === 'string' ? JSON.parse(jsonOutput) : jsonOutput;

  const platform = detectPlatformFromUrl(contentUrl);

  return {
    id: parsed.id,
    title: parsed.title || 'Untitled media item',
    durationSeconds: Number.isFinite(parsed.duration) ? Math.round(parsed.duration) : null,
    publishedAt: parsed.upload_date ? new Date(`${parsed.upload_date.slice(0, 4)}-${parsed.upload_date.slice(4, 6)}-${parsed.upload_date.slice(6, 8)}T00:00:00Z`) : null,
    url: parsed.webpage_url || contentUrl,
    uploaderId: parsed.uploader_id || parsed.channel_id || null,
    uploaderName: parsed.uploader || parsed.channel || `${platform} source`,
    metadata: parsed,
    platform
  };
}

async function extractTranscript(contentUrl, externalContentId) {
  const workdir = await mkdtemp(path.join(tmpdir(), 'content-transcript-'));
  const outputTemplate = path.join(workdir, '%(id)s.%(ext)s');

  try {
    await runYtDlp(contentUrl, {
      writeAutoSubs: true,
      writeSubs: true,
      subLangs: 'en.*,en,all,-live_chat',
      subFormat: 'vtt',
      skipDownload: true,
      noPlaylist: true,
      output: outputTemplate
    });

    const files = readdirSync(workdir);
    const vttFile = files.find((file) => file.startsWith(`${externalContentId}.`) && file.endsWith('.vtt'));
    if (!vttFile) {
      throw createNoTranscriptError();
    }

    const vttFilePath = path.join(workdir, vttFile);
    if (!existsSync(vttFilePath)) {
      throw createNoTranscriptError();
    }

    const vttContent = await readFile(vttFilePath, 'utf-8');
    const transcript = parseVttToTranscript(vttContent);
    await rm(vttFilePath, { force: true });

    if (!transcript.length) {
      throw createNoTranscriptError();
    }

    return transcript;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

export async function fetchAndStoreTranscript(contentUrl, sourceOverride = null) {
  let metadata = null;

  try {
    metadata = await getContentMetadata(contentUrl);
    const source = sourceOverride || (await ensureSource({
      platform: metadata.platform,
      handle: metadata.uploaderId || 'default',
      displayName: metadata.uploaderName || `${metadata.platform} source`,
      sourceUrl: contentUrl,
      isActive: true,
      ingestSettings: { mode: 'manual' }
    }));

    const transcript = await extractTranscript(contentUrl, metadata.id);
    const transcriptText = transcript.map((entry) => entry.text).join(' ').trim();

    let analysis = null;
    try {
      analysis = await analyzeTranscript({ title: metadata.title, durationSeconds: metadata.durationSeconds, transcript, transcriptText });
    } catch {
      analysis = { analysisStatus: 'failed', analyzedAt: new Date(), keyPoints: [], entities: {}, tags: [], sections: [], notableQuotes: [] };
    }

    await upsertContentItem({
      sourceId: source.id,
      externalContentId: metadata.id,
      platform: metadata.platform,
      contentType: 'video',
      title: metadata.title,
      transcript,
      transcriptText,
      url: metadata.url,
      publishedAt: metadata.publishedAt,
      durationSeconds: metadata.durationSeconds,
      ingestStatus: 'completed',
      ingestError: null,
      rawMetadata: metadata.metadata,
      analysis
    });

    return { videoId: metadata.id, title: metadata.title, durationSeconds: metadata.durationSeconds, transcript, platform: metadata.platform, sourceId: source.id };
  } catch (error) {
    if (error?.statusCode === 404 && metadata) {
      const source = sourceOverride || (await ensureSource({
        platform: metadata.platform,
        handle: metadata.uploaderId || 'default',
        displayName: metadata.uploaderName || `${metadata.platform} source`,
        sourceUrl: contentUrl,
        isActive: true,
        ingestSettings: { mode: 'manual' }
      }));

      await markContentNoTranscript({
        sourceId: source.id,
        externalContentId: metadata.id,
        platform: metadata.platform,
        contentType: 'video',
        title: metadata.title,
        durationSeconds: metadata.durationSeconds,
        url: metadata.url,
        message: error?.payload?.error || error.message
      });
      throw error;
    }

    const classification = classifyYtDlpError(error);
    const internalError = new Error(classification.message);
    internalError.statusCode = classification.type === 'no_subtitles' ? 404 : 500;
    internalError.payload = { error: classification.message };
    if (DEV_VERBOSE_ERRORS) {
      internalError.details = { type: classification.type, stderr: error?.stderr?.toString?.() || '', message: error?.message || '' };
    }
    throw internalError;
  }
}

export async function fetchAndStoreTranscriptByExternalId({ platform = 'vimeo', externalId, source }) {
  const contentUrl = platform === 'youtube' ? `https://www.youtube.com/watch?v=${externalId}` : `https://vimeo.com/${externalId}`;
  return fetchAndStoreTranscript(contentUrl, source);
}
