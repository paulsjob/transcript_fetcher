function VideoList({ videos, activeVideoId, onSelectVideo, loading, error }) {
  return (
    <section className="col-span-12 rounded-md border border-border bg-surface p-3 shadow-subtle lg:col-span-5">
      <h2 className="text-h2 font-heading text-brand-primary">Videos</h2>
      {loading && <p className="mt-2 text-body text-textMuted">Loading videos...</p>}
      {error && <p className="mt-2 text-body text-danger">{error}</p>}
      {!loading && !error && videos.length === 0 && <p className="mt-2 text-body text-textMuted">No public videos returned.</p>}

      <div className="mt-2 space-y-1">
        {videos.map((video) => {
          const isActive = video.id === activeVideoId;
          return (
            <button
              key={video.id}
              type="button"
              onClick={() => onSelectVideo(video)}
              className={`w-full rounded-md border p-2 text-left transition-colors ${
                isActive
                  ? 'border-brand-accent bg-surfaceSubtle'
                  : 'border-border bg-surface hover:bg-surfaceSubtle'
              }`}
            >
              <p className="text-body font-semibold text-brand-primary">{video.name}</p>
              <p className="mt-1 text-small text-textMuted">Video ID: {video.id}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default VideoList;
