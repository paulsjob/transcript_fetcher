export async function searchArchive(query) {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`/api/search?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to search transcripts.');
  }

  return payload;
}
