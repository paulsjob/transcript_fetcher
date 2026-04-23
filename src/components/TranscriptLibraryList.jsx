function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}

export default function TranscriptLibraryList({ items, selectedId, loading, error, filters, onFiltersChange, onSelect, sources = [] }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
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
          <option value="fetchedAt:desc">Newest fetched</option>
          <option value="fetchedAt:asc">Oldest fetched</option>
          <option value="publishedAt:desc">Newest published</option>
          <option value="publishedAt:asc">Oldest published</option>
          <option value="title:asc">Title A → Z</option>
          <option value="title:desc">Title Z → A</option>
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select
          value={filters.platform || 'any'}
          onChange={(e) => onFiltersChange({ platform: e.target.value, sourceId: 'any' })}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="any">All platforms</option>
          {[...new Set(sources.map((source) => source.platform))].map((platform) => (
            <option key={platform} value={platform}>{platform}</option>
          ))}
        </select>
        <select
          value={filters.sourceId || 'any'}
          onChange={(e) => onFiltersChange({ sourceId: e.target.value })}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="any">All sources</option>
          {sources
            .filter((source) => (filters.platform && filters.platform !== 'any' ? source.platform === filters.platform : true))
            .map((source) => (
              <option key={source.id} value={source.id}>{source.displayName}</option>
            ))}
        </select>
      </div>

      {error ? <p className="text-small text-danger">{error}</p> : null}
      {loading ? <p className="text-small text-textMuted">Refreshing library…</p> : null}

      {!items.length ? <p className="text-small text-textMuted">No content items found.</p> : items.map((item) => {
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-body font-semibold text-text">{item.title}</p>
              <span className="rounded-full bg-surfaceSubtle px-2 py-0.5 text-[11px] uppercase text-textMuted">{item.platform}</span>
            </div>
            <p className="text-small text-textMuted">Source: {item.source?.displayName || item.source?.handle || 'Unknown'}</p>
            <p className="text-small text-textMuted">Fetched: {formatDate(item.fetchedAt)}</p>
            {item.publishedAt ? <p className="text-small text-textMuted">Published: {formatDate(item.publishedAt)}</p> : null}
            {item.durationSeconds ? <p className="text-small text-textMuted">Duration: {formatDuration(item.durationSeconds)}</p> : null}
            {item.preview ? <p className="mt-1 line-clamp-2 text-small text-textMuted">{item.preview}</p> : null}
          </button>
        );
      })}
    </div>
  );
}
