function toQueryString(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    const normalized = `${value}`.trim();
    if (!normalized || normalized === 'any') {
      return;
    }

    params.set(key, normalized);
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchTranscriptLibrary(filters = {}) {
  const response = await fetch(`/api/transcripts${toQueryString(filters)}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to load transcript library.');
  }

  return payload;
}

export async function fetchTranscriptById(id) {
  const response = await fetch(`/api/transcripts/${id}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to load transcript detail.');
  }

  return payload;
}

export async function deleteTranscriptById(id) {
  const response = await fetch(`/api/transcripts/${id}`, { method: 'DELETE' });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to delete transcript.');
  }

  return payload;
}
