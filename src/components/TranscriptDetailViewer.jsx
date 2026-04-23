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

function serializeWithTimestamps(entries) {
  return entries.map((line) => `${line.timestamp} ${line.text}`.trim()).join('\n');
}

function serializeTextOnly(entries, fallbackText) {
  if (!entries.length) {
    return fallbackText || '';
  }

  return entries.map((line) => line.text).join('\n');
}

function triggerFileDownload(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(value, label) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    window.alert(`Unable to ${label}. Copy failed in this browser.`);
  }
}

export default function TranscriptDetailViewer({ transcript, loading, error, onDelete, deleting }) {
  if (loading) {
    return <p className="text-small text-textMuted">Loading transcript…</p>;
  }

  if (error) {
    return <p className="text-small text-danger">{error}</p>;
  }

  if (!transcript) {
    return <p className="text-small text-textMuted">No transcript selected. Pick one from the library.</p>;
  }

  const entries = toEntries(transcript.transcriptJson, transcript.transcriptText);
  const transcriptWithTimestamps = serializeWithTimestamps(entries);
  const transcriptTextOnly = serializeTextOnly(entries, transcript.transcriptText);
  const baseFileName = transcript.title.trim().replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || transcript.videoId;

  function handleDelete() {
    const confirmed = window.confirm(`Delete transcript "${transcript.title}"? This cannot be undone.`);

    if (confirmed) {
      onDelete(transcript.id);
    }
  }

  function handleJsonDownload() {
    const payload = {
      id: transcript.id,
      title: transcript.title,
      videoId: transcript.videoId,
      fetchedAt: transcript.fetchedAt,
      lineCount: entries.length,
      transcript: entries
    };

    triggerFileDownload(`${baseFileName}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  return (
    <article className="space-y-2">
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

        <dl className="grid gap-1 text-small text-textMuted sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-text">Video ID</dt>
            <dd className="font-mono">{transcript.videoId}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text">Fetched</dt>
            <dd>{formatDate(transcript.fetchedAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text">Line count</dt>
            <dd>{entries.length}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text">Title</dt>
            <dd>{transcript.title}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => copyToClipboard(transcriptWithTimestamps, 'copy transcript')}
            className="rounded-md border border-border bg-surfaceSubtle px-2 py-1 text-small text-text transition hover:border-focus"
          >
            Copy full transcript
          </button>
          <button
            type="button"
            onClick={() => copyToClipboard(transcriptTextOnly, 'copy transcript text')}
            className="rounded-md border border-border bg-surfaceSubtle px-2 py-1 text-small text-text transition hover:border-focus"
          >
            Copy transcript text only
          </button>
          <button
            type="button"
            onClick={() => triggerFileDownload(`${baseFileName}.txt`, transcriptWithTimestamps, 'text/plain;charset=utf-8')}
            className="rounded-md border border-border bg-surfaceSubtle px-2 py-1 text-small text-text transition hover:border-focus"
          >
            Download .txt
          </button>
          <button
            type="button"
            onClick={handleJsonDownload}
            className="rounded-md border border-border bg-surfaceSubtle px-2 py-1 text-small text-text transition hover:border-focus"
          >
            Download .json
          </button>
        </div>
      </header>

      <div className="max-h-[65vh] overflow-y-auto rounded-md border border-border bg-surfaceSubtle p-2">
        {entries.length ? (
          <div className="space-y-2">
            {entries.map((line, index) => (
              <div
                key={`${line.timestamp || 'line'}-${index}`}
                className="grid grid-cols-[72px_1fr] gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
              >
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
