import { useEffect, useMemo, useRef, useState } from 'react';
import Player from '@vimeo/player';
import { deleteVideoById, fetchVideoById, fetchVideos, searchTranscriptLines, syncVimeoArchive } from './api/vimeo';

function statusLabel(status) {
  if (status === 'no_subtitles') return 'no subtitles';
  return status || 'pending';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


function parseTimestampToSeconds(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const parts = String(value).split(':').map(Number);

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return Number(value) || 0;
}

function secondsFromSegment(segment = {}) {
  if (Number.isFinite(segment.startSeconds)) return Math.max(0, Math.floor(segment.startSeconds));
  if (Number.isFinite(segment.start)) return Math.max(0, Math.floor(segment.start));
  return parseTimestampToSeconds(segment.start);
}

function formatSecondsAsTimestamp(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function extractVimeoId(url = '') {
  if (typeof url !== 'string' || !url.trim()) return '';
  const match = url.match(/vimeo\.com\/(?:.*\/)?(\d+)(?:$|[?#/])/i);
  return match?.[1] || '';
}

function getVimeoVideoId(video = {}) {
  if (!video) return '';
  return video.videoId || video.externalId || extractVimeoId(video.url);
}

function getVimeoEmbedUrl(videoId) {
  return `https://player.vimeo.com/video/${videoId}`;
}

function HighlightedText({ text = '', query = '' }) {
  if (!query.trim()) return <>{text}</>;
  const pattern = new RegExp(`(${escapeRegExp(query.trim())})`, 'ig');
  const parts = text.split(pattern);
  const normalizedQuery = query.trim().toLowerCase();
  return parts.map((part, index) => (
    part.toLowerCase() === normalizedQuery
      ? <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-0.5 text-slate-950">{part}</mark>
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function HighlightedMatch({ text = '', matchIndices = [] }) {
  if (!matchIndices.length) return <>{text}</>;
  const pieces = [];
  let cursor = 0;

  matchIndices.forEach((match, index) => {
    const start = Math.max(0, Math.min(text.length, match.start));
    const end = Math.max(start, Math.min(text.length, match.end));
    if (start > cursor) pieces.push(<span key={`text-${index}`}>{text.slice(cursor, start)}</span>);
    if (end > start) {
      pieces.push(<mark key={`match-${index}`} className="rounded bg-orange-100 px-0.5 font-semibold text-orange-950">{text.slice(start, end)}</mark>);
    }
    cursor = end;
  });

  if (cursor < text.length) pieces.push(<span key="text-tail">{text.slice(cursor)}</span>);
  return pieces;
}

function TranscriptSearchResults({ query, results, loading, error, onSelectResult }) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-950">Timestamp search results</h2>
          <p className="text-sm text-slate-500">Line-level matches for “{trimmedQuery}” can open the matching video and jump the embedded player to that timestamp.</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{results.length} match{results.length === 1 ? '' : 'es'}</span>
      </div>

      {loading ? <p className="mt-3 text-sm text-slate-500">Searching transcript lines…</p> : null}
      {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!loading && !error && !results.length ? <p className="mt-3 text-sm text-slate-500">No timestamped transcript lines matched this search.</p> : null}

      {results.length ? (
        <div className="mt-4 grid gap-3">
          {results.map((result) => {
            const startSeconds = parseTimestampToSeconds(result.lineStartSeconds ?? result.lineTimestamp ?? result.lineTimestampLabel);
            const timestampLabel = result.lineTimestampLabel || (Number.isFinite(startSeconds) ? formatSecondsAsTimestamp(startSeconds) : 'timestamp');
            return (
              <article key={result.id} className="rounded-lg border border-slate-200 p-3 transition hover:border-orange-200 hover:bg-orange-50/30">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-950">{result.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{result.sourceDisplayName || 'Vimeo'}</span>
                      {result.publishedAt ? <span>Published {new Date(result.publishedAt).toLocaleDateString()}</span> : null}
                    </div>
                  </div>
                  {result.vimeoUrlAtTime ? (
                    <a href={result.vimeoUrlAtTime} target="_blank" rel="noreferrer" className="rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50">
                      Open on Vimeo
                    </a>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => onSelectResult(result)}
                  className="mt-3 grid w-full cursor-pointer gap-3 rounded-md p-2 text-left transition hover:bg-orange-100/60 focus:outline-none focus:ring-2 focus:ring-orange-300 md:grid-cols-[5rem_1fr]"
                  title={`Jump to ${timestampLabel} in video`}
                  aria-label={`Jump to ${timestampLabel} in ${result.title}`}
                >
                  <span className="inline-flex w-fit items-center rounded-full bg-orange-100 px-2.5 py-1 font-mono text-xs font-semibold text-orange-900 hover:bg-orange-200">
                    {timestampLabel}
                  </span>
                  <span className="text-sm leading-6 text-slate-800">
                    <HighlightedMatch text={result.lineText} matchIndices={result.matchIndices || []} />
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function VideoList({ videos, selectedId, onSelect, loading }) {
  if (loading) return <p className="text-sm text-slate-500">Loading Vimeo archive…</p>;
  if (!videos.length) return <p className="text-sm text-slate-500">No Vimeo videos ingested yet. Click Sync Vimeo Archive to start.</p>;

  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {videos.map((video) => (
        <li key={video.id}>
          <button
            type="button"
            onClick={() => onSelect(video.id)}
            className={`w-full p-4 text-left transition hover:bg-slate-50 ${selectedId === video.id ? 'bg-blue-50' : 'bg-white'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-slate-950">{video.title}</h3>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${video.textTrackStatus === 'completed' ? 'bg-green-100 text-green-700' : video.textTrackStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                {statusLabel(video.textTrackStatus)}
              </span>
            </div>
            {video.preview ? <p className="mt-2 text-sm text-slate-600">{video.preview}</p> : null}
            <p className="mt-2 text-xs text-slate-400">Fetched {video.fetchedAt ? new Date(video.fetchedAt).toLocaleString() : 'not yet'}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

function TranscriptLine({ segment, index, query, isMatch, lineRef, onSeek }) {
  const startSeconds = secondsFromSegment(segment);
  const timestampLabel = typeof segment.start === 'string' && segment.start.trim()
    ? segment.start
    : formatSecondsAsTimestamp(startSeconds);
  const seekLabel = `Jump to ${timestampLabel} in video`;

  return (
    <button
      ref={lineRef}
      type="button"
      onClick={() => onSeek(segment)}
      title={seekLabel}
      aria-label={`${seekLabel}: transcript line ${index + 1}`}
      className={`transcript-row grid w-full gap-3 rounded-md p-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-300 md:grid-cols-[5rem_1fr] ${isMatch ? 'bg-yellow-50' : ''}`}
    >
      <span className="timestamp-link font-mono text-xs font-semibold" title={seekLabel}>
        {timestampLabel}
      </span>

      <span className="transcript-text leading-6 text-slate-800">
        <HighlightedText text={segment.text} query={query} />
      </span>
    </button>
  );
}

function TranscriptDetail({ video, query, loading, error, onDelete, seekTarget }) {
  const firstMatchRef = useRef(null);
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const videoId = getVimeoVideoId(video);
  const embedUrl = videoId ? getVimeoEmbedUrl(videoId) : null;

  useEffect(() => {
    if (query.trim() && firstMatchRef.current) {
      firstMatchRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [video?.id, query]);

  useEffect(() => {
    playerRef.current = null;
    if (!embedUrl || !iframeRef.current) return undefined;

    const player = new Player(iframeRef.current);
    playerRef.current = player;

    return () => {
      playerRef.current = null;
      player.destroy().catch((destroyError) => {
        console.warn('Unable to destroy Vimeo player', destroyError);
      });
    };
  }, [embedUrl]);

  async function seekToTranscriptLine(line) {
    const seconds = secondsFromSegment(line);
    if (!Number.isFinite(seconds) || !playerRef.current) return;

    try {
      await playerRef.current.setCurrentTime(seconds);
      await playerRef.current.play();
    } catch (seekError) {
      console.warn('Unable to seek Vimeo player', seekError);
    }
  }

  useEffect(() => {
    if (!seekTarget || seekTarget.contentItemId !== video?.id) return;
    seekToTranscriptLine({ startSeconds: seekTarget.seconds, start: seekTarget.timestampLabel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTarget, video?.id, embedUrl]);

  const segments = useMemo(() => Array.isArray(video?.transcriptJson) ? video.transcriptJson : [], [video]);
  const normalizedQuery = query.trim().toLowerCase();
  let firstMatchAssigned = false;

  if (loading) return <p className="text-sm text-slate-500">Loading transcript…</p>;
  if (error) return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!video) return <p className="text-sm text-slate-500">Select a video to view its transcript.</p>;

  return (
    <article className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{video.title}</h2>
            {video.url ? <a href={video.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 hover:underline">Open on Vimeo</a> : null}
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{statusLabel(video.textTrackStatus)}</span>
        </div>
        {video.description ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{video.description}</p> : null}
        {video.ingestError ? <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{video.ingestError}</p> : null}
        <button type="button" onClick={() => onDelete(video.id)} className="mt-3 rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50">Delete local record</button>
      </div>

      {embedUrl ? (
        <div className="video-player-card overflow-hidden rounded-lg border border-slate-200 bg-black shadow-sm">
          <iframe
            ref={iframeRef}
            key={videoId}
            src={embedUrl}
            title={`${video.title} Vimeo player`}
            className="aspect-video w-full"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
            allowFullScreen
          />
        </div>
      ) : null}

      <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-slate-950">Transcript</h3>
        {video.textTrackStatus === 'no_subtitles' ? <p className="text-sm text-slate-500">Vimeo has no captions or subtitles available for this video.</p> : null}
        {video.textTrackStatus === 'failed' ? <p className="text-sm text-slate-500">Transcript ingest failed. Re-run sync after resolving the error.</p> : null}
        {segments.length ? (
          <div className="space-y-3">
            {segments.map((segment, index) => {
              const isMatch = normalizedQuery && segment.text.toLowerCase().includes(normalizedQuery);
              const ref = isMatch && !firstMatchAssigned ? firstMatchRef : null;
              if (isMatch && !firstMatchAssigned) firstMatchAssigned = true;
              return (
                <TranscriptLine
                  key={`${segment.start}-${index}`}
                  segment={segment}
                  index={index}
                  query={query}
                  isMatch={isMatch}
                  lineRef={ref}
                  onSeek={seekToTranscriptLine}
                />
              );
            })}
          </div>
        ) : video.transcriptText ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800"><HighlightedText text={video.transcriptText} query={query} /></p>
        ) : null}
      </div>
    </article>
  );
}

function App() {
  const [videos, setVideos] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [query, setQuery] = useState('');
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [syncSummary, setSyncSummary] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [seekTarget, setSeekTarget] = useState(null);

  async function loadVideos(preferredId = selectedId) {
    setLoadingVideos(true);
    setError('');
    try {
      const data = await fetchVideos(query);
      setVideos(data);
      if (preferredId && data.some((video) => video.id === preferredId)) {
        setSelectedId(preferredId);
      } else {
        setSelectedId(data[0]?.id || '');
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingVideos(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { loadVideos(); }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchError('');
      setLoadingSearch(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      setSearchError('');
      try {
        const data = await searchTranscriptLines(trimmedQuery, { limit: 100 });
        if (!cancelled) setSearchResults(data);
      } catch (loadError) {
        if (!cancelled) setSearchError(loadError.message);
      } finally {
        if (!cancelled) setLoadingSearch(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedVideo(null);
      return;
    }
    let cancelled = false;
    async function loadDetail() {
      setLoadingDetail(true);
      setDetailError('');
      try {
        const data = await fetchVideoById(selectedId);
        if (!cancelled) setSelectedVideo(data);
      } catch (loadError) {
        if (!cancelled) setDetailError(loadError.message);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }
    loadDetail();
    return () => { cancelled = true; };
  }, [selectedId]);

  async function handleSync() {
    setSyncing(true);
    setError('');
    setSyncSummary(null);
    try {
      const summary = await syncVimeoArchive();
      setSyncSummary(summary);
      await loadVideos(selectedId);
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      setSyncing(false);
    }
  }

  function handleSearchResultSelect(result) {
    const seconds = parseTimestampToSeconds(result.lineStartSeconds ?? result.lineTimestamp ?? result.lineTimestampLabel);
    setSelectedId(result.contentItemId);
    setSeekTarget({
      contentItemId: result.contentItemId,
      seconds: Number.isFinite(seconds) ? seconds : 0,
      timestampLabel: result.lineTimestampLabel,
      requestedAt: Date.now()
    });
  }

  async function handleDelete(id) {
    await deleteVideoById(id);
    setSelectedVideo(null);
    await loadVideos('');
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">The Bench Vimeo Transcript Archive</h1>
            <p className="text-sm text-slate-600">Authenticated Vimeo ingest, local SQLite storage, and searchable transcript browsing.</p>
          </div>
          <button type="button" onClick={handleSync} disabled={syncing} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300">
            {syncing ? 'Syncing…' : 'Sync Vimeo Archive'}
          </button>
        </header>

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {syncSummary ? (
          <section className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
            Sync complete: {syncSummary.discovered} discovered, {syncSummary.alreadyCompleted} skipped, {syncSummary.newlyProcessed} transcripts processed, {syncSummary.noSubtitles} no subtitles, {syncSummary.failed} failed.
          </section>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label htmlFor="archive-search" className="text-sm font-semibold text-slate-700">Search title, description, and timestamped transcript lines</label>
          <input
            id="archive-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the Vimeo archive…"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </section>

        <TranscriptSearchResults query={query} results={searchResults} loading={loadingSearch} error={searchError} onSelectResult={handleSearchResultSelect} />

        <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <aside className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Library</h2>
              <span className="text-sm text-slate-500">{videos.length} video{videos.length === 1 ? '' : 's'}</span>
            </div>
            <VideoList videos={videos} selectedId={selectedId} onSelect={setSelectedId} loading={loadingVideos} />
          </aside>

          <section>
            <TranscriptDetail video={selectedVideo} query={query} loading={loadingDetail} error={detailError} onDelete={handleDelete} seekTarget={seekTarget} />
          </section>
        </section>
      </div>
    </main>
  );
}

export default App;
