function TranscriptView({
  selectedVideo,
  loadingTracks,
  tracksError,
  tracks,
  activeTrackId,
  onSelectTrack,
  loadingTranscript,
  transcriptText,
  transcriptError
}) {
  return (
    <section className="col-span-12 rounded-md border border-border bg-surface p-3 shadow-subtle lg:col-span-7">
      <h2 className="text-h2 font-heading text-brand-primary">Transcript View</h2>

      {!selectedVideo && <p className="mt-2 text-body text-textMuted">Choose a video to load transcript tracks.</p>}

      {selectedVideo && (
        <>
          <p className="mt-1 text-body text-brand-secondary">{selectedVideo.name}</p>

          {loadingTracks && <p className="mt-2 text-body text-textMuted">Loading text tracks...</p>}
          {tracksError && <p className="mt-2 text-body text-danger">{tracksError}</p>}

          {!loadingTracks && !tracksError && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tracks.length === 0 && <p className="text-body text-warning">No transcript tracks found for this video.</p>}
              {tracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onSelectTrack(track)}
                  className={`rounded-md border px-2 py-1 text-small font-semibold ${
                    activeTrackId === track.id
                      ? 'border-brand-accent bg-brand-accent text-text'
                      : 'border-border bg-surfaceSubtle text-brand-secondary'
                  }`}
                >
                  {track.label}
                </button>
              ))}
            </div>
          )}

          {loadingTranscript && <p className="mt-2 text-body text-textMuted">Loading transcript text...</p>}
          {transcriptError && <p className="mt-2 text-body text-danger">{transcriptError}</p>}

          {!loadingTranscript && !transcriptError && transcriptText && (
            <article className="mt-2 max-h-[55vh] overflow-y-auto rounded-md border border-border bg-surfaceSubtle p-2 whitespace-pre-wrap text-body text-text">
              {transcriptText}
            </article>
          )}
        </>
      )}
    </section>
  );
}

export default TranscriptView;
