import '../../config/env.js';

const VIMEO_API_BASE = 'https://api.vimeo.com';

function getToken() {
  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) {
    const error = new Error('VIMEO_ACCESS_TOKEN is required to sync the Vimeo archive.');
    error.status = 400;
    throw error;
  }
  return token;
}

function normalizeApiPath(pathOrUrl) {
  if (!pathOrUrl) return pathOrUrl;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;
  return `${VIMEO_API_BASE}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

async function vimeoRequest(pathOrUrl, options = {}) {
  const response = await fetch(normalizeApiPath(pathOrUrl), {
    ...options,
    headers: {
      Accept: 'application/vnd.vimeo.*+json;version=3.4',
      Authorization: `bearer ${getToken()}`,
      ...(options.headers || {})
    }
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    const error = new Error(`Vimeo rate limit reached${retryAfter ? `; retry after ${retryAfter} seconds` : ''}.`);
    error.status = 429;
    throw error;
  }

  if (!response.ok) {
    let details = '';
    try {
      const body = await response.json();
      details = body?.error || body?.message || JSON.stringify(body);
    } catch {
      details = await response.text();
    }
    const error = new Error(`Vimeo API request failed (${response.status})${details ? `: ${details}` : ''}`);
    error.status = response.status;
    throw error;
  }

  return response;
}

function getConfiguredVideosPath() {
  if (process.env.VIMEO_ACCOUNT_URI) {
    return `${process.env.VIMEO_ACCOUNT_URI.replace(/\/$/, '')}/videos`;
  }
  if (process.env.VIMEO_USER_ID) {
    return `/users/${process.env.VIMEO_USER_ID}/videos`;
  }
  return '/me/videos';
}

export function extractVimeoVideoId(video) {
  if (video?.uri) return video.uri.split('/').filter(Boolean).pop();
  if (video?.link) return video.link.split('/').filter(Boolean).pop();
  return video?.resource_key || video?.name;
}

export async function fetchAllVimeoVideos({ limit = null } = {}) {
  const videos = [];
  const params = new URLSearchParams({ per_page: '100', sort: 'date', direction: 'desc' });
  let nextUrl = `${getConfiguredVideosPath()}?${params.toString()}`;

  while (nextUrl) {
    const response = await vimeoRequest(nextUrl);
    const page = await response.json();
    const pageVideos = Array.isArray(page?.data) ? page.data : [];
    videos.push(...pageVideos);

    if (limit && videos.length >= limit) {
      return videos.slice(0, limit);
    }

    nextUrl = page?.paging?.next || null;
  }

  return videos;
}

export async function fetchVimeoTextTracks(video) {
  const textTracksPath = video?.metadata?.connections?.texttracks?.uri || (video?.uri ? `${video.uri}/texttracks` : null);
  if (!textTracksPath) return [];
  const response = await vimeoRequest(textTracksPath);
  const body = await response.json();
  return Array.isArray(body?.data) ? body.data : [];
}

export async function fetchTextTrackFile(track) {
  const link = track?.link || track?.download_link;
  if (!link) {
    throw new Error('Selected Vimeo text track does not include a downloadable link.');
  }
  const response = await vimeoRequest(link, { headers: { Accept: 'text/vtt,text/plain,*/*' } });
  return response.text();
}
