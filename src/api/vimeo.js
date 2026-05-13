const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export function syncVimeoArchive({ force = false } = {}) {
  return request('/vimeo/sync', {
    method: 'POST',
    body: JSON.stringify({ force })
  });
}

export function fetchVideos(query = '') {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  return request(`/videos${params.toString() ? `?${params.toString()}` : ''}`);
}

export function fetchVideoById(id) {
  return request(`/videos/${id}`);
}

export function deleteVideoById(id) {
  return request(`/videos/${id}`, { method: 'DELETE' });
}

export function searchTranscriptLines(query = '', { limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (limit) params.set('limit', String(limit));
  return request(`/search${params.toString() ? `?${params.toString()}` : ''}`);
}
