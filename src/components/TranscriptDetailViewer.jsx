import { useEffect, useMemo, useRef, useState } from 'react';

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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeQuery(searchFocus) {
  const query = (searchFocus?.query || searchFocus?.matchText || '').trim();
  return query;
}

function buildHighlightedText(text, query, lineIndex, activeMatchIndex, setMatchRef, matchCounterRef) {
  if (!query) {
    return text;
  }

  const pattern = new RegExp(escapeRegex(query), 'gi');
  const matches = [...text.matchAll(pattern)];

  if (!matches.length) {
    return text;
  }

  const nodes = [];
  let cursor = 0;

  matches.forEach((match, idx) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;

    if (start > cursor) {
      nodes.push(
        <span key={`plain-${lineIndex}-${idx}-${cursor}`}>{text.slice(cursor, start)}</span>
      );
    }

    const globalIndex = matchCounterRef.current;
    matchCounterRef.current += 1;

    const isActive = globalIndex === activeMatchIndex;

    nodes.push(
      <mark
        key={`match-${lineIndex}-${idx}-${start}`}
        ref={(node) => setMatchRef(globalIndex, node)}
        data-match-index={globalIndex}
        className={`rounded px-0.5 ${isActive ? 'bg-amber-300 ring-1 ring-amber-500' : 'bg-yellow-200'}`}
      >
        {text.slice(start, end)}
      </mark>
    );

    cursor = end;
  });

  if (cursor < text.length) {
    nodes.push(<span key={`tail-${lineIndex}-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return nodes;
}

function findInitialMatchIndex(matchLineIndices, searchFocus) {
  if (!matchLineIndices.length) {
    return -1;
  }

  if (Number.isInteger(searchFocus?.bestLineIndex)) {
    const preferredLineMatch = matchLineIndices.findIndex((lineIndex) => lineIndex === searchFocus.bestLineIndex);
    if (preferredLineMatch !== -1) {
      return preferredLineMatch;
    }
  }

  return 0;
}

export default function TranscriptDetailViewer({ transcript, loading, error, onDelete, deleting, searchFocus }) {
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const matchRefs = useRef({});

  const entries = toEntries(transcript?.transcriptJson, transcript?.transcriptText);
  const transcriptWithTimestamps = serializeWithTimestamps(entries);
  const transcriptTextOnly = serializeTextOnly(entries, transcript?.transcriptText);
  const baseFileName =
    transcript?.title?.trim().replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || transcript?.videoId || 'transcript';
  const query = normalizeQuery(searchFocus);

  const matchLineIndices = useMemo(() => {
    if (!query) {
      return [];
    }

    const pattern = new RegExp(escapeRegex(query), 'i');
    const indices = [];

    entries.forEach((line, lineIndex) => {
      const hits = line.text.match(new RegExp(escapeRegex(query), 'gi')) || [];
      hits.forEach(() => indices.push(lineIndex));
    });

    if (!indices.length && searchFocus?.bestTimestamp) {
      const byTimestamp = entries.findIndex((entry) => entry.timestamp === searchFocus.bestTimestamp && pattern.test(entry.text));
      if (byTimestamp !== -1) {
        return [byTimestamp];
      }
    }

    return indices;
  }, [entries, query, searchFocus?.bestTimestamp]);

  useEffect(() => {
    matchRefs.current = {};
    const initial = findInitialMatchIndex(matchLineIndices, searchFocus);
    setActiveMatchIndex(initial);
  }, [transcript?.id, query, matchLineIndices, searchFocus]);

  useEffect(() => {
    if (activeMatchIndex < 0) {
      return;
    }

    const activeNode = matchRefs.current[activeMatchIndex];
    if (activeNode) {
      activeNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [activeMatchIndex, transcript?.id]);

  function setMatchRef(index, node) {
    if (node) {
      matchRefs.current[index] = node;
      return;
    }

    delete matchRefs.current[index];
  }

  function handleDelete() {
    if (!transcript) {
      return;
    }

    const confirmed = window.confirm(`Delete transcript "${transcript.title}"? This cannot be undone.`);

    if (confirmed) {
      onDelete(transcript.id);
    }
  }

  function handleJsonDownload() {
    if (!transcript) {
      return;
    }

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

  function moveMatch(direction) {
    if (!matchLineIndices.length) {
      return;
    }

    setActiveMatchIndex((current) => {
      const start = current < 0 ? 0 : current;
      return (start + direction + matchLineIndices.length) % matchLineIndices.length;
    });
  }

  const renderMatchCounterRef = { current: 0 };

  if (loading) {
    return <p className="text-small text-textMuted">Loading transcript…</p>;
  }

  if (error) {
    return <p className="text-small text-danger">{error}</p>;
  }

  if (!transcript) {
    return <p className="text-small text-textMuted">No transcript selected. Pick one from the library.</p>;
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

        {query ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surfaceSubtle p-2 text-small">
            <span className="text-textMuted">
              Matches for <strong className="text-text">“{query}”</strong>: {matchLineIndices.length}
            </span>
            {matchLineIndices.length ? (
              <>
                <button
                  type="button"
                  onClick={() => moveMatch(-1)}
                  className="rounded-md border border-border px-2 py-1 text-text transition hover:border-focus"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => moveMatch(1)}
                  className="rounded-md border border-border px-2 py-1 text-text transition hover:border-focus"
                >
                  Next
                </button>
                <span className="text-textMuted">Active: {activeMatchIndex + 1}</span>
              </>
            ) : (
              <span className="text-textMuted">No exact line match found; showing transcript with best-effort highlighting.</span>
            )}
          </div>
        ) : null}

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
            {entries.map((line, index) => {
              return (
                <div
                  key={`${line.timestamp || 'line'}-${index}`}
                  id={`transcript-line-${index}`}
                  className="grid grid-cols-[72px_1fr] gap-2 border-b border-border pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="font-mono text-small text-textMuted">{line.timestamp || '—'}</span>
                  <p className="whitespace-pre-wrap break-words text-body text-text">
                    {buildHighlightedText(line.text || '', query, index, activeMatchIndex, setMatchRef, renderMatchCounterRef)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-body text-text">No transcript text available.</p>
        )}
      </div>
    </article>
  );
}
