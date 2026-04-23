function safeParseTranscriptEntries(transcriptJson) {
  if (Array.isArray(transcriptJson)) {
    return transcriptJson;
  }

  if (typeof transcriptJson !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(transcriptJson);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toEntries(transcriptJson, transcriptText) {
  const parsedEntries = safeParseTranscriptEntries(transcriptJson);

  if (parsedEntries && parsedEntries.length) {
    return parsedEntries.map((entry) => ({
      timestamp: entry?.timestamp || '—',
      text: entry?.text || ''
    }));
  }

  if (!transcriptText) {
    return [];
  }

  return transcriptText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ timestamp: '—', text: line }));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
}

function formatDuration(seconds) {
  if (!seconds) {
    return 'Unknown';
  }

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

export default function TranscriptDetailViewer({ transcript, loading, error, onDelete, deleting }) {
  const entries = toEntries(transcript?.transcriptJson, transcript?.transcriptText);

  function handleDelete() {
    if (!transcript) {
      return;
    }

    const confirmed = window.confirm(`Delete transcript "${transcript.title}"? This cannot be undone.`);

    if (confirmed) {
      onDelete(transcript.id);
    }
  }

  if (loading) return <p className="text-small text-textMuted">Loading transcript…</p>;
  if (error) return <p className="text-small text-danger">{error}</p>;
  if (!transcript) return <p className="text-small text-textMuted">No transcript selected. Pick one from the library.</p>;

  return (
    <article className="space-y-3">
      <header className="space-y-2 border-b border-border pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-h3 text-text">{transcript.title}</h3>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-danger px-2 py-1 text-small font-semibold text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete transcript'}
          </button>
        </div>

        <p className="text-small text-textMuted">Fetched: {formatDate(transcript.fetchedAt)}</p>
        <p className="text-small text-textMuted">Duration: {formatDuration(transcript.durationSeconds)}</p>

        {transcript.synopsis ? (
          <section className="space-y-1 rounded-md border border-border bg-surfaceSubtle p-2">
            <h4 className="text-body font-semibold text-text">Synopsis</h4>
            <p className="text-small text-textMuted">{transcript.synopsis}</p>
          </section>
        ) : null}

        {transcript.keyPoints?.length ? (
          <section className="space-y-1 rounded-md border border-border bg-surfaceSubtle p-2">
            <h4 className="text-body font-semibold text-text">Key points</h4>
            <ul className="list-disc space-y-1 pl-5 text-small text-textMuted">
              {transcript.keyPoints.map((point, index) => (
                <li key={`${point}-${index}`}>{point}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </header>

      <div className="max-h-[65vh] overflow-y-auto rounded-md border border-border bg-surfaceSubtle p-2">
        {entries.length ? (
          <div className="space-y-2">
            {entries.map((line, index) => (
              <div key={`${line.timestamp || 'line'}-${index}`} className="grid grid-cols-[72px_1fr] gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0">
                <span className="font-mono text-small text-textMuted">{line.timestamp || '—'}</span>
                <p className="whitespace-pre-wrap break-words text-body text-text">{line.text || ''}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-body text-text">No transcript text available.</p>
        )}
      </div>
    </article>
  );
}
