import { useEffect, useMemo, useState } from 'react';
import { fetchTranscript } from './api/transcript';
import { deleteTranscriptById, fetchTranscriptById, fetchTranscriptLibrary } from './api/transcripts';
import { fetchSources } from './api/sources';
import TranscriptDetailViewer from './components/TranscriptDetailViewer';
import TranscriptLibraryList from './components/TranscriptLibraryList';
import TranscriptPanel from './components/TranscriptPanel';
import UrlInputForm from './components/UrlInputForm';

const DEFAULT_LIBRARY_OPTIONS = { q: '', sortBy: 'fetchedAt', sortOrder: 'desc', platform: 'any', sourceId: 'any' };

function App() {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [sources, setSources] = useState([]);
  const [activeTab, setActiveTab] = useState('master');

  const [library, setLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [libraryOptions, setLibraryOptions] = useState(DEFAULT_LIBRARY_OPTIONS);

  const [selectedTranscriptId, setSelectedTranscriptId] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadSources() {
    try {
      const data = await fetchSources();
      setSources(data);
    } catch {
      setSources([]);
    }
  }

  async function loadLibrary(preferredSelectionId = '', options = libraryOptions) {
    setLibraryLoading(true);
    setLibraryError('');
    try {
      const data = await fetchTranscriptLibrary(options);
      setLibrary(data);
      const selectedId = preferredSelectionId || selectedTranscriptId;
      if (selectedId && data.some((item) => item.id === selectedId)) {
        setSelectedTranscriptId(selectedId);
        return;
      }
      setSelectedTranscriptId(data[0]?.id || '');
    } catch (loadError) {
      setLibraryError(loadError.message);
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => { loadSources(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => { loadLibrary('', libraryOptions); }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryOptions]);

  useEffect(() => {
    if (!selectedTranscriptId) {
      setSelectedTranscript(null);
      setDetailError('');
      return;
    }

    let cancelled = false;
    async function loadTranscriptDetail() {
      setDetailLoading(true);
      setDetailError('');
      try {
        const data = await fetchTranscriptById(selectedTranscriptId);
        if (!cancelled) setSelectedTranscript(data);
      } catch (loadError) {
        if (!cancelled) {
          setDetailError(loadError.message);
          setSelectedTranscript(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadTranscriptDetail();
    return () => { cancelled = true; };
  }, [selectedTranscriptId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setTranscript([]);
    try {
      const data = await fetchTranscript(url);
      setTranscript(data);
      await loadSources();
      await loadLibrary();
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTranscript(id) {
    setDeleteLoading(true);
    setDetailError('');
    try {
      await deleteTranscriptById(id);
      await loadLibrary();
      if (selectedTranscriptId === id) {
        setSelectedTranscriptId('');
        setSelectedTranscript(null);
      }
    } catch (deleteError) {
      setDetailError(deleteError.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  const sourceTabs = useMemo(() => [{ id: 'master', label: 'Master Index' }, ...sources.map((source) => ({ id: source.id, label: source.displayName }))], [sources]);

  const librarySubtitle = useMemo(() => (libraryLoading ? 'Loading archive library…' : `${library.length} item${library.length === 1 ? '' : 's'}`), [library.length, libraryLoading]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 bg-background px-3 py-4">
      <header className="space-y-1">
        <h1 className="text-h1 text-text">Media Archive Master Index</h1>
        <p className="text-body text-textMuted">Source-aware ingest and searchable archive across platforms.</p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {sourceTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setLibraryOptions((current) => ({ ...current, sourceId: tab.id === 'master' ? 'any' : tab.id, platform: tab.id === 'master' ? current.platform : 'any' }));
            }}
            className={`rounded-md border px-3 py-1 text-sm ${activeTab === tab.id ? 'border-focus bg-surfaceSubtle text-text' : 'border-border text-textMuted'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="grid gap-3 lg:grid-cols-[420px_1fr]">
        <section className="space-y-2 rounded-md border border-border bg-surface p-3">
          <h2 className="text-h3 text-text">Library</h2>
          <p className="text-small text-textMuted">{librarySubtitle}</p>
          <TranscriptLibraryList
            items={library}
            selectedId={selectedTranscriptId}
            loading={libraryLoading}
            error={libraryError}
            filters={libraryOptions}
            sources={sources}
            onFiltersChange={(next) => setLibraryOptions((current) => ({ ...current, ...next }))}
            onSelect={(id) => setSelectedTranscriptId(id)}
          />
        </section>

        <section className="space-y-2 rounded-md border border-border bg-surface p-3">
          <h2 className="text-h3 text-text">Detail</h2>
          <TranscriptDetailViewer transcript={selectedTranscript} loading={detailLoading} error={detailError} onDelete={handleDeleteTranscript} deleting={deleteLoading} activeSearchTerm={libraryOptions.q} />
        </section>
      </section>

      <section className="space-y-2">
        <h2 className="text-h3 text-text">Fetch a new media transcript</h2>
        <p className="text-small text-textMuted">Paste a Vimeo or YouTube URL to ingest into its source archive.</p>
        <UrlInputForm url={url} onUrlChange={setUrl} onSubmit={handleSubmit} loading={loading} />
        <TranscriptPanel transcript={transcript} loading={loading} error={error} />
      </section>
    </main>
  );
}

export default App;
