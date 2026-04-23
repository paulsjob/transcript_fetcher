import { VIMEO_API_BASE_URL, VIMEO_USER_ID, resolveVimeoToken } from '../config/vimeo';

const API_VERSION_HEADER = 'application/vnd.vimeo.*+json;version=3.4';

function createHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: API_VERSION_HEADER
  };
}

function mapVimeoError(status) {
  if (status === 401 || status === 403) {
    return 'Authentication failed. Check your Vimeo Personal Access Token.';
  }

  if (status === 404) {
    return 'Resource not found. The video or transcript may no longer be public.';
  }

  if (status === 429) {
    return 'Rate limit reached. Wait a moment and try again.';
  }

  if (status >= 500) {
    return 'Vimeo service is temporarily unavailable. Try again shortly.';
  }

  return 'Request failed. Please verify token scopes and endpoint access.';
}

async function requestJson(path, tokenOverride = '') {
  const token = resolveVimeoToken(tokenOverride);

  if (!token) {
    throw new Error('Missing token. Add VITE_VIMEO_TOKEN or paste token in the config input.');
  }

  const response = await fetch(`${VIMEO_API_BASE_URL}${path}`, {
    method: 'GET',
    headers: createHeaders(token)
  });

  if (!response.ok) {
    throw new Error(mapVimeoError(response.status));
  }

  return response.json();
}

export async function fetchUserVideos(tokenOverride = '') {
  const payload = await requestJson(`/users/${VIMEO_USER_ID}/videos`, tokenOverride);
  return (payload.data ?? []).map((video) => ({
    id: video.uri?.split('/').pop() ?? '',
    name: video.name ?? 'Untitled Video',
    duration: video.duration ?? 0,
    createdTime: video.created_time ?? '',
    description: video.description ?? ''
  }));
}

export async function fetchVideoTextTracks(videoId, tokenOverride = '') {
  const payload = await requestJson(`/videos/${videoId}/texttracks`, tokenOverride);
  return (payload.data ?? []).map((track) => ({
    id: track.uri?.split('/').pop() ?? `${videoId}-${track.language}`,
    language: track.language ?? 'unknown',
    label: track.name ?? track.language ?? 'Transcript',
    kind: track.type ?? 'subtitles',
    link: track.link ?? ''
  }));
}

export async function fetchTranscriptText(trackLink, tokenOverride = '') {
  const token = resolveVimeoToken(tokenOverride);

  if (!token) {
    throw new Error('Missing token. Add VITE_VIMEO_TOKEN or paste token in the config input.');
  }

  const response = await fetch(trackLink, {
    method: 'GET',
    headers: createHeaders(token)
  });

  if (!response.ok) {
    throw new Error(mapVimeoError(response.status));
  }

  return response.text();
}

export function normalizeTranscriptText(rawText = '') {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line === 'WEBVTT') return false;
      if (/^\d+$/.test(line)) return false;
      if (/^\d{2}:\d{2}:\d{2}/.test(line) || line.includes('-->')) return false;
      return true;
    })
    .join('\n');
}
