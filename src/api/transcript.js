export async function fetchTranscript(url) {
  const response = await fetch('/api/fetch-transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const rawBody = await response.text();
  let payload = {};

  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const backendMessage =
      payload.error || payload.message || rawBody || (response.status === 404 ? 'No subtitles available for this video' : '');
    throw new Error(backendMessage || 'Unable to fetch transcript.');
  }

  return payload.transcript ?? [];
}
