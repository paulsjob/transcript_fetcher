function EmptyState({ message }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surfaceSubtle p-3 text-body text-textMuted">
      {message}
    </div>
  );
}

export default function TranscriptPanel({ transcript, loading, error }) {
  if (loading) {
    return <EmptyState message="Fetching transcript…" />;
  }

  if (error) {
    return <EmptyState message={error} />;
  }

  if (!transcript.length) {
    return <EmptyState message="Paste a Vimeo URL and fetch to see transcript lines." />;
  }

  return (
    <div className="max-h-[65vh] space-y-2 overflow-y-auto rounded-md border border-border bg-surface p-3 shadow-subtle">
      {transcript.map((line, index) => (
        <div key={`${line.timestamp}-${index}`} className="grid grid-cols-[72px_1fr] gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0">
          <span className="font-mono text-small text-textMuted">{line.timestamp}</span>
          <p className="text-body text-text">{line.text}</p>
        </div>
      ))}
    </div>
  );
}
