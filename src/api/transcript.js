export async function fetchTranscript(url) {
  const response = await fetch('/api/fetch-transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || 'Unable to fetch transcript.');
  }

  return payload.transcript ?? [];
}
