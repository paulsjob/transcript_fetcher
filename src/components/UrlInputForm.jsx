export default function UrlInputForm({ url, onUrlChange, onSubmit, loading }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border bg-surface p-3 shadow-subtle">
      <label htmlFor="media-url" className="block text-small text-textMuted">
        Media URL (Vimeo or YouTube)
      </label>
      <input
        id="media-url"
        type="url"
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        placeholder="https://vimeo.com/123456789 or https://www.youtube.com/watch?v=..."
        className="w-full rounded-md border border-border bg-white px-3 py-2 text-body outline-none transition focus:border-focus"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-brand-primary px-3 py-2 text-body font-semibold text-white transition hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Fetching…' : 'Fetch Transcript'}
      </button>
    </form>
  );
}
