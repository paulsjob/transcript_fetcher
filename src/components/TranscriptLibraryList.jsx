function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
}

function formatDuration(seconds) {
  if (!seconds) {
    return null;
  }

  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

export default function TranscriptLibraryList({ items, selectedId, loading, error, filters, onFiltersChange, onSelect }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_170px]">
        <input
          type="search"
          value={filters.q}
          onChange={(e) => onFiltersChange({ q: e.target.value })}
          placeholder="Search title and transcript text"
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        />
        <select
          value={`${filters.sortBy}:${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split(':');
            onFiltersChange({ sortBy, sortOrder });
          }}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="fetchedAt:desc">Newest first</option>
          <option value="fetchedAt:asc">Oldest first</option>
          <option value="title:asc">Title A → Z</option>
          <option value="title:desc">Title Z → A</option>
        </select>
      </div>

      {error ? <p className="text-small text-danger">{error}</p> : null}
      {loading ? <p className="text-small text-textMuted">Refreshing library…</p> : null}

      {!items.length ? (
        <p className="text-small text-textMuted">No transcripts found.</p>
      ) : (
        items.map((item) => {
          const isSelected = item.id === selectedId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full rounded-md border p-3 text-left shadow-subtle transition ${
                isSelected ? 'border-focus bg-surfaceSubtle ring-1 ring-focus' : 'border-border bg-surface hover:border-focus/70'
              }`}
            >
              <p className="text-body font-semibold text-text">{item.title}</p>
              <p className="text-small text-textMuted">Fetched: {formatDate(item.fetchedAt)}</p>
              {item.durationSeconds ? <p className="text-small text-textMuted">Duration: {formatDuration(item.durationSeconds)}</p> : null}
              {item.preview ? <p className="mt-1 line-clamp-2 text-small text-textMuted">{item.preview}</p> : null}
            </button>
          );
        })
      )}
    </div>
  );
}
