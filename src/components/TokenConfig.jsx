function TokenConfig({ tokenInput, onTokenInput, onReloadVideos, disabled }) {
  return (
    <section className="col-span-12 rounded-md border border-border bg-surface p-3 shadow-subtle">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-small font-semibold uppercase tracking-wide text-brand-secondary">Authentication Setup</p>
          <h1 className="mt-1 text-h2 font-heading text-brand-primary">Vimeo Transcript Fetcher</h1>
          <p className="mt-1 text-body text-textMuted">Paste a personal token or use VITE_VIMEO_TOKEN in your .env file.</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onReloadVideos}
          className="rounded-md bg-brand-accent px-2 py-1 text-small font-semibold text-text transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          Refresh Videos
        </button>
      </div>

      <label className="mt-2 block text-small font-semibold text-brand-secondary" htmlFor="token-input">
        Personal Access Token
      </label>
      <input
        id="token-input"
        type="password"
        autoComplete="off"
        value={tokenInput}
        onChange={(event) => onTokenInput(event.target.value)}
        placeholder="Paste token here for this session"
        className="mt-1 w-full rounded-md border border-border bg-surfaceSubtle px-2 py-1 text-body text-text outline-none focus:ring-2 focus:ring-focus"
      />
    </section>
  );
}

export default TokenConfig;
