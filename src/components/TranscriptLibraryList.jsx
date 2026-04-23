function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
}

export default function TranscriptLibraryList({ items, selectedId, loading, error, onSelect }) {
  if (loading) {
    return <p className="text-small text-textMuted">Loading transcript library…</p>;
  }

  if (error) {
    return <p className="text-small text-danger">{error}</p>;
  }

  if (!items.length) {
    return <p className="text-small text-textMuted">No saved transcripts yet. Fetch one to get started.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isSelected = item.id === selectedId;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full rounded-md border p-3 text-left shadow-subtle transition ${
              isSelected ? 'border-focus bg-surfaceSubtle' : 'border-border bg-surface hover:border-focus/70'
            }`}
          >
            <p className="text-body font-semibold text-text">{item.title}</p>
            <p className="font-mono text-small text-textMuted">Video ID: {item.videoId}</p>
            <p className="text-small text-textMuted">Fetched: {formatDate(item.fetchedAt)}</p>
            {item.preview ? <p className="mt-1 text-small text-textMuted">{item.preview}</p> : null}
          </button>
        );
      })}
    </div>
  );
}
