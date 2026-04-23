export async function fetchSources() {
  const response = await fetch('/api/sources');
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Unable to load sources.');
  }
  return payload;
}
