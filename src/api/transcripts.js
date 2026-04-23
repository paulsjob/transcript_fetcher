export async function fetchTranscriptLibrary() {
  const response = await fetch('/api/transcripts');
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
