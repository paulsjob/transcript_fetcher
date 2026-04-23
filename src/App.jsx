import { useEffect, useMemo, useState } from 'react';
import { fetchTranscript } from './api/transcript';
import { deleteTranscriptById, fetchTranscriptById, fetchTranscriptLibrary } from './api/transcripts';
import TranscriptDetailViewer from './components/TranscriptDetailViewer';
import TranscriptLibraryList from './components/TranscriptLibraryList';
import TranscriptPanel from './components/TranscriptPanel';
import UrlInputForm from './components/UrlInputForm';

const DEFAULT_LIBRARY_OPTIONS = {
  q: '',
  sortBy: 'fetchedAt',
  sortOrder: 'desc'
};

function App() {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [library, setLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [libraryOptions, setLibraryOptions] = useState(DEFAULT_LIBRARY_OPTIONS);

  const [selectedTranscriptId, setSelectedTranscriptId] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLibrary('', libraryOptions);
    }, 250);

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
        if (!cancelled) {
          setSelectedTranscript(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setDetailError(loadError.message);
          setSelectedTranscript(null);
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadTranscriptDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedTranscriptId]);

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError('');
    setTranscript([]);

    try {
      const data = await fetchTranscript(url);
      setTranscript(data);
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

  const librarySubtitle = useMemo(() => {
    if (libraryLoading) {
      return 'Loading transcript library…';
    }

    return `${library.length} transcript${library.length === 1 ? '' : 's'}`;
  }, [library.length, libraryLoading]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 bg-background px-3 py-4">
      <header className="space-y-1">
        <h1 className="text-h1 text-text">Vimeo Transcript Fetcher</h1>
        <p className="text-body text-textMuted">Fetch, store, search, and read transcripts.</p>
      </header>

      <section className="grid gap-3 lg:grid-cols-[420px_1fr]">
        <section className="space-y-2 rounded-md border border-border bg-surface p-3">
          <h2 className="text-h3 text-text">Transcript library</h2>
          <p className="text-small text-textMuted">{librarySubtitle}</p>
          <TranscriptLibraryList
            items={library}
            selectedId={selectedTranscriptId}
            loading={libraryLoading}
            error={libraryError}
            filters={libraryOptions}
            onFiltersChange={(next) => setLibraryOptions((current) => ({ ...current, ...next }))}
            onSelect={(id) => setSelectedTranscriptId(id)}
          />
        </section>

        <section className="space-y-2 rounded-md border border-border bg-surface p-3">
          <h2 className="text-h3 text-text">Transcript</h2>
          <TranscriptDetailViewer
            transcript={selectedTranscript}
            loading={detailLoading}
            error={detailError}
            onDelete={handleDeleteTranscript}
            deleting={deleteLoading}
            activeSearchTerm={libraryOptions.q}
          />
        </section>
      </section>

      <section className="space-y-2">
        <h2 className="text-h3 text-text">Fetch a new transcript</h2>
        <UrlInputForm url={url} onUrlChange={setUrl} onSubmit={handleSubmit} loading={loading} />
        <TranscriptPanel transcript={transcript} loading={loading} error={error} />
      </section>
    </main>
  );
}

export default App;
