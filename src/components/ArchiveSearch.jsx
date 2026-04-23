import { useEffect, useMemo, useState } from 'react';
import { searchArchive } from '../api/search';

const DEBOUNCE_MS = 300;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text, query) {
  if (!query) {
    return text;
  }

  const pattern = new RegExp(`(${escapeRegex(query)})`, 'ig');
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <strong key={`${part}-${index}`} className="font-semibold text-text">
        {part}
      </strong>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export default function ArchiveSearch({ onSelectResult }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    let isCancelled = false;

    async function runSearch() {
      if (!debouncedQuery) {
        setResults([]);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const data = await searchArchive(debouncedQuery);

        if (!isCancelled) {
          setResults(data);
        }
      } catch (searchError) {
        if (!isCancelled) {
          setError(searchError.message);
          setResults([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    runSearch();

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery]);

  const resultLabel = useMemo(() => {
    if (!debouncedQuery) {
      return 'Start typing to search your transcript archive.';
    }

    if (loading) {
      return 'Searching archive…';
    }

    return `${results.length} result${results.length === 1 ? '' : 's'} for “${debouncedQuery}”`;
  }, [debouncedQuery, loading, results.length]);

  return (
    <section className="space-y-2">
      <div className="rounded-md border border-border bg-surface p-2 shadow-subtle">
        <label htmlFor="archive-search" className="mb-1 block text-small text-textMuted">
          Search transcript archive
        </label>
        <input
          id="archive-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or transcript text"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-body text-text outline-none transition focus:border-focus focus:ring-1 focus:ring-focus"
        />
      </div>

      <p className="text-small text-textMuted">{resultLabel}</p>

      {error ? <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-small text-danger">{error}</div> : null}

      <div className="space-y-1">
        {results.map((result) => (
          <article
            key={result.id}
            className="cursor-pointer rounded-md border border-border bg-surface p-2 shadow-subtle"
            onClick={() => onSelectResult?.(result.id)}
          >
            <h2 className="text-body font-semibold text-text">{result.title}</h2>
            <p className="mt-1 text-small text-textMuted">{highlightText(result.snippet, debouncedQuery)}</p>
            <p className="mt-1 font-mono text-small text-textMuted">Video ID: {result.videoId}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
