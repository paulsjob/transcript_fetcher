function parseTranscriptJson(transcriptJson) {
  if (Array.isArray(transcriptJson)) {
    return transcriptJson;
  }

  if (typeof transcriptJson !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(transcriptJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
}

export default function TranscriptDetailViewer({ transcript, loading, error }) {
  if (loading) {
    return <p className="text-small text-textMuted">Loading transcript…</p>;
  }

  if (error) {
    return <p className="text-small text-danger">{error}</p>;
  }

  if (!transcript) {
    return <p className="text-small text-textMuted">Select a transcript to read it in full.</p>;
  }

  const entries = parseTranscriptJson(transcript.transcriptJson);

  return (
    <article className="space-y-2">
      <header className="border-b border-border pb-2">
        <h3 className="text-h3 text-text">{transcript.title}</h3>
        <p className="font-mono text-small text-textMuted">Video ID: {transcript.videoId}</p>
        <p className="text-small text-textMuted">Fetched: {formatDate(transcript.fetchedAt)}</p>
      </header>

      {entries.length ? (
        <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
          {entries.map((line, index) => (
            <div
              key={`${line.timestamp || 'line'}-${index}`}
              className="grid grid-cols-[72px_1fr] gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
            >
              <span className="font-mono text-small text-textMuted">{line.timestamp || '—'}</span>
              <p className="text-body text-text">{line.text || ''}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-body text-text">{transcript.transcriptText}</p>
      )}
    </article>
  );
}
