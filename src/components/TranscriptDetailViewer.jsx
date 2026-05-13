import { useEffect, useMemo, useRef } from 'react';
import Player from '@vimeo/player';

function statusLabel(status) {
  if (status === 'no_subtitles') return 'no subtitles';
  return status || 'pending';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseTimestampToSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return 0;

  const stringValue = String(value).trim();
  if (!stringValue) return 0;

  const parts = stringValue.split(':').map((part) => Number(part));

  if (parts.length === 2 && parts.every(Number.isFinite)) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  const numericValue = Number(stringValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function secondsFromLine(line = {}) {
  const rawValue = line.start ?? line.seconds ?? line.timestamp ?? line.startSeconds;
  const seconds = parseTimestampToSeconds(rawValue);
  return Math.max(0, Math.floor(seconds));
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

function getVimeoVideoId(transcript = {}) {
  if (!transcript) return '';
  return transcript.videoId || transcript.externalId || extractVimeoId(transcript.url);
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

function TranscriptLine({ line, index, query, isMatch, lineRef, onSeek }) {
  const startSeconds = secondsFromLine(line);
  const timestampLabel = line.timestamp || (typeof line.start === 'string' && line.start.trim()
    ? line.start
    : formatSecondsAsTimestamp(startSeconds));

  return (
    <button
      ref={lineRef}
      type="button"
      onClick={() => onSeek(line)}
      className={`group grid w-full cursor-pointer grid-cols-[72px_1fr] gap-2 border-b border-border pb-2 text-left transition hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-focus last:border-b-0 last:pb-0 ${isMatch ? 'bg-yellow-50' : ''}`}
      title={`Jump to ${timestampLabel || 'this time'} in video`}
      aria-label={`Jump to ${timestampLabel || 'this time'} in video: transcript line ${index + 1}`}
    >
      <span className="font-mono text-small font-semibold text-brand-primary underline-offset-2 group-hover:underline">
        {timestampLabel}
      </span>

      <span className="transcript-text leading-6 text-slate-800">
        <HighlightedText text={line.text} query={query} />
      </span>
    </button>
  );
}

export default function TranscriptDetailViewer({ video: transcript, query, loading, error, onDelete, seekTarget }) {
  const firstMatchRef = useRef(null);
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const videoId = getVimeoVideoId(transcript);
  const embedUrl = videoId ? `https://player.vimeo.com/video/${videoId}` : null;

  useEffect(() => {
    if (query.trim() && firstMatchRef.current) {
      firstMatchRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [transcript?.id, query]);

  useEffect(() => {
    playerRef.current = null;
    if (!videoId || !iframeRef.current) return undefined;

    const player = new Player(iframeRef.current);
    playerRef.current = player;

    return () => {
      playerRef.current = null;
      player.destroy().catch((destroyError) => {
        console.warn('Unable to destroy Vimeo player', destroyError);
      });
    };
  }, [videoId]);

  async function seekToLine(line) {
    const seconds = secondsFromLine(line);
    if (!Number.isFinite(seconds) || !playerRef.current) return;

    try {
      await playerRef.current.setCurrentTime(seconds);
      await playerRef.current.play();
    } catch (seekError) {
      console.warn('Unable to seek Vimeo player', seekError);
    }
  }

  useEffect(() => {
    if (!seekTarget || seekTarget.contentItemId !== transcript?.id) return;
    seekToLine({ seconds: seekTarget.seconds, timestamp: seekTarget.timestampLabel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTarget, transcript?.id, videoId]);

  const entries = useMemo(() => Array.isArray(transcript?.transcriptJson) ? transcript.transcriptJson : [], [transcript]);
  const normalizedQuery = query.trim().toLowerCase();
  let firstMatchAssigned = false;

  if (loading) return <p className="text-sm text-slate-500">Loading transcript…</p>;
  if (error) return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!transcript) return <p className="text-sm text-slate-500">Select a video to view its transcript.</p>;

  return (
    <article className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{transcript.title}</h2>
            {transcript.url ? <a href={transcript.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-700 hover:underline">Open on Vimeo</a> : null}
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{statusLabel(transcript.textTrackStatus)}</span>
        </div>
        {transcript.description ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{transcript.description}</p> : null}
        {transcript.ingestError ? <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">{transcript.ingestError}</p> : null}
        <button type="button" onClick={() => onDelete(transcript.id)} className="mt-3 rounded-md border border-red-200 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50">Delete local record</button>
      </div>

      {embedUrl ? (
        <div className="video-player-card overflow-hidden rounded-lg border border-slate-200 bg-black shadow-sm">
          <iframe
            ref={iframeRef}
            key={videoId}
            src={embedUrl}
            title={`${transcript.title} Vimeo player`}
            className="aspect-video w-full"
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
            allowFullScreen
          />
        </div>
      ) : null}

      <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-slate-950">Transcript</h3>
        {transcript.textTrackStatus === 'no_subtitles' ? <p className="text-sm text-slate-500">Vimeo has no captions or subtitles available for this video.</p> : null}
        {transcript.textTrackStatus === 'failed' ? <p className="text-sm text-slate-500">Transcript ingest failed. Re-run sync after resolving the error.</p> : null}
        {entries.length ? (
          <div className="space-y-3">
            {entries.map((line, index) => {
              const isMatch = normalizedQuery && line.text.toLowerCase().includes(normalizedQuery);
              const ref = isMatch && !firstMatchAssigned ? firstMatchRef : null;
              if (isMatch && !firstMatchAssigned) firstMatchAssigned = true;
              return (
                <TranscriptLine
                  key={`${line.timestamp || line.start || 'line'}-${index}`}
                  line={line}
                  index={index}
                  query={query}
                  isMatch={isMatch}
                  lineRef={ref}
                  onSeek={seekToLine}
                />
              );
            })}
          </div>
        ) : transcript.transcriptText ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800"><HighlightedText text={transcript.transcriptText} query={query} /></p>
        ) : null}
      </div>
    </article>
  );
}
