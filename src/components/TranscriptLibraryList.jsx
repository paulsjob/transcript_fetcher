import { useMemo, useState } from 'react';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A-Z' },
  { value: 'title-desc', label: 'Title Z-A' }
];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
}

function sortItems(items, sort) {
  const sorted = [...items];

  if (sort === 'oldest') {
    sorted.sort((a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime());
    return sorted;
  }

  if (sort === 'title-asc') {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }

  if (sort === 'title-desc') {
    sorted.sort((a, b) => b.title.localeCompare(a.title));
    return sorted;
  }

  sorted.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime());
  return sorted;
}

function matchesFilter(item, query) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return (
    item.title.toLowerCase().includes(normalized) ||
    item.videoId.toLowerCase().includes(normalized) ||
    (item.preview || '').toLowerCase().includes(normalized) ||
    (item.synopsis || '').toLowerCase().includes(normalized) ||
    (item.tags || []).some((tag) => `${tag}`.toLowerCase().includes(normalized)) ||
    (item.themes || []).some((theme) => `${theme}`.toLowerCase().includes(normalized))
  );
}

export default function TranscriptLibraryList({ items, selectedId, loading, error, onSelect }) {
  const [sort, setSort] = useState('newest');
  const [filter, setFilter] = useState('');

  const filteredItems = useMemo(() => {
    const visible = items.filter((item) => matchesFilter(item, filter.trim()));
    return sortItems(visible, sort);
  }, [filter, items, sort]);

  if (loading) {
    return <p className="text-small text-textMuted">Loading transcript library…</p>;
  }

  if (error) {
    return <p className="text-small text-danger">{error}</p>;
  }

  if (!items.length) {
    return <p className="text-small text-textMuted">No transcripts in your library yet. Fetch one to get started.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-small text-textMuted">Filter</span>
          <input
            type="text"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search title, video ID, synopsis, themes, tags"
            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-body text-text outline-none transition focus:border-focus"
          />
        </label>

        <label className="space-y-1">
          <span className="text-small text-textMuted">Sort</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-2 py-1 text-body text-text outline-none transition focus:border-focus"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-small text-textMuted">
        {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
      </p>

      {!filteredItems.length ? (
        <p className="text-small text-textMuted">No transcripts match that filter.</p>
      ) : (
        filteredItems.map((item) => {
          const isSelected = item.id === selectedId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full rounded-md border p-3 text-left shadow-subtle transition ${
                isSelected
                  ? 'border-focus bg-surfaceSubtle ring-1 ring-focus'
                  : 'border-border bg-surface hover:border-focus/70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-body font-semibold text-text">{item.title}</p>
                {isSelected ? <span className="text-small font-semibold text-brand-secondary">Selected</span> : null}
              </div>
              <p className="font-mono text-small text-textMuted">Video ID: {item.videoId}</p>
              {item.durationSeconds ? <p className="text-small text-textMuted">Duration: {Math.round(item.durationSeconds)}s</p> : null}
              <p className="text-small text-textMuted">Fetched: {formatDate(item.fetchedAt)}</p>
              {item.themes?.length ? (
                <p className="text-small text-textMuted">Themes: {item.themes.join(', ')}</p>
              ) : null}
              {item.tags?.length ? <p className="text-small text-textMuted">Tags: {item.tags.slice(0, 6).join(', ')}</p> : null}
              {item.analysisStatus ? (
                <p className="text-small text-textMuted">Analysis: {item.analysisStatus}</p>
              ) : null}
              {item.preview ? <p className="mt-1 text-small text-textMuted">{item.preview}</p> : null}
            </button>
          );
        })
      )}
    </div>
  );
}
