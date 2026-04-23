function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
}

function entityPreview(entities = {}, max = 3) {
  return Object.values(entities).flat().filter(Boolean).slice(0, max);
}

function statusBadge(value, tone = 'neutral') {
  if (!value) {
    return null;
  }

  const palette = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    neutral: 'border-border bg-surfaceSubtle text-textMuted'
  };

  return <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${palette[tone] || palette.neutral}`}>{value}</span>;
}

export default function TranscriptLibraryList({
  items,
  selectedId,
  loading,
  error,
  filters,
  onFiltersChange,
  onClearFilters,
  onSelect
}) {
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'sortBy') return value !== 'fetchedAt';
    if (key === 'sortOrder') return value !== 'desc';
    if (key === 'durationBucket') return value !== 'any';
    return Boolean(`${value || ''}`.trim());
  });

  if (loading) {
    return <p className="text-small text-textMuted">Loading transcript library…</p>;
  }

  if (error) {
    return <p className="text-small text-danger">{error}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <input type="search" value={filters.q} onChange={(e) => onFiltersChange({ q: e.target.value })} placeholder="Search title, transcript, synopsis, tags, entities, quotes" className="rounded-md border border-border bg-surface px-2 py-1 text-sm" />
        <input type="text" value={filters.tag} onChange={(e) => onFiltersChange({ tag: e.target.value })} placeholder="Tag/topic" className="rounded-md border border-border bg-surface px-2 py-1 text-sm" />
        <input type="text" value={filters.entity} onChange={(e) => onFiltersChange({ entity: e.target.value })} placeholder="Entity" className="rounded-md border border-border bg-surface px-2 py-1 text-sm" />
        <select value={filters.analysisStatus} onChange={(e) => onFiltersChange({ analysisStatus: e.target.value })} className="rounded-md border border-border bg-surface px-2 py-1 text-sm">
          <option value="">Analysis: any</option>
          <option value="completed">Analysis: completed</option>
          <option value="pending">Analysis: pending</option>
          <option value="failed">Analysis: failed</option>
        </select>
        <select value={filters.ingestStatus} onChange={(e) => onFiltersChange({ ingestStatus: e.target.value })} className="rounded-md border border-border bg-surface px-2 py-1 text-sm">
          <option value="">Ingest: any</option>
          <option value="completed">Ingest: completed</option>
          <option value="failed">Ingest: failed</option>
          <option value="no_subtitles">Ingest: no subtitles</option>
        </select>
        <select value={filters.durationBucket} onChange={(e) => onFiltersChange({ durationBucket: e.target.value })} className="rounded-md border border-border bg-surface px-2 py-1 text-sm">
          <option value="any">Duration: any</option>
          <option value="short">Short (&lt;5m)</option>
          <option value="medium">Medium (5-20m)</option>
          <option value="long">Long (&gt;20m)</option>
        </select>
        <select value={filters.sortBy} onChange={(e) => onFiltersChange({ sortBy: e.target.value })} className="rounded-md border border-border bg-surface px-2 py-1 text-sm">
          <option value="fetchedAt">Sort: fetched date</option>
          <option value="title">Sort: title</option>
          <option value="durationSeconds">Sort: duration</option>
        </select>
        <select value={filters.sortOrder} onChange={(e) => onFiltersChange({ sortOrder: e.target.value })} className="rounded-md border border-border bg-surface px-2 py-1 text-sm">
          <option value="desc">Order: desc</option>
          <option value="asc">Order: asc</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-small text-textMuted">{items.length} result{items.length === 1 ? '' : 's'}</p>
        {hasActiveFilters ? <button type="button" onClick={onClearFilters} className="text-small text-brand-secondary underline">Clear filters</button> : null}
      </div>

      {!items.length ? (
        <p className="text-small text-textMuted">No transcripts match your current search and filters.</p>
      ) : (
        items.map((item) => {
          const isSelected = item.id === selectedId;
          const entities = entityPreview(item.entities);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full rounded-md border p-3 text-left shadow-subtle transition ${
                isSelected ? 'border-focus bg-surfaceSubtle ring-1 ring-focus' : 'border-border bg-surface hover:border-focus/70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-body font-semibold text-text">{item.title}</p>
                <div className="flex gap-1">
                  {statusBadge(item.analysisStatus || 'not analyzed', item.analysisStatus === 'completed' ? 'success' : 'warning')}
                  {statusBadge(item.ingestStatus || 'unknown', item.ingestStatus === 'completed' ? 'success' : 'neutral')}
                </div>
              </div>
              <p className="text-small text-textMuted">Fetched: {formatDate(item.fetchedAt)}</p>
              {item.durationSeconds ? <p className="text-small text-textMuted">Duration: {Math.round(item.durationSeconds)}s</p> : null}
              {item.synopsis ? <p className="mt-1 line-clamp-2 text-small text-textMuted">{item.synopsis}</p> : <p className="mt-1 text-small text-textMuted">No analysis synopsis yet.</p>}
              {item.tags?.length ? <p className="text-small text-textMuted">Tags: {item.tags.slice(0, 4).join(', ')}</p> : null}
              {entities.length ? <p className="text-small text-textMuted">Entities: {entities.join(', ')}</p> : null}
              {item.matchingQuoteSnippet ? <p className="text-small text-brand-secondary">Quote match: “{item.matchingQuoteSnippet}”</p> : null}
              {item.matchedFields?.length ? <p className="text-small text-textMuted">Matched on: {item.matchedFields.join(', ')}</p> : null}
            </button>
          );
        })
      )}
    </div>
  );
}
