import { useEffect, useState } from 'react';
import { fetchTranscript } from './api/transcript';
import { fetchTranscriptById, fetchTranscriptLibrary } from './api/transcripts';
import ArchiveSearch from './components/ArchiveSearch';
import TranscriptDetailViewer from './components/TranscriptDetailViewer';
import TranscriptLibraryList from './components/TranscriptLibraryList';
import TranscriptPanel from './components/TranscriptPanel';
import UrlInputForm from './components/UrlInputForm';

function App() {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [library, setLibrary] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [selectedTranscriptId, setSelectedTranscriptId] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  async function loadLibrary(preferredSelectionId = '') {
    setLibraryLoading(true);
    setLibraryError('');

    try {
      const data = await fetchTranscriptLibrary();
      setLibrary(data);

      const selectedId = preferredSelectionId || selectedTranscriptId;

      if (selectedId && data.some((item) => item.id === selectedId)) {
        setSelectedTranscriptId(selectedId);
        return;
      }

      if (!selectedTranscriptId && data.length) {
        setSelectedTranscriptId(data[0].id);
      } else if (!data.length) {
        setSelectedTranscriptId('');
      }
    } catch (loadError) {
      setLibraryError(loadError.message);
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTranscriptId) {
      setSelectedTranscript(null);
      setDetailError('');
      return;
    }

    let isCancelled = false;

    async function loadTranscriptDetail() {
      setDetailLoading(true);
      setDetailError('');

      try {
        const data = await fetchTranscriptById(selectedTranscriptId);
        if (!isCancelled) {
          setSelectedTranscript(data);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setDetailError(loadError.message);
          setSelectedTranscript(null);
        }
      } finally {
        if (!isCancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadTranscriptDetail();

    return () => {
      isCancelled = true;
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 bg-background px-3 py-4">
      <header className="space-y-1">
        <h1 className="text-h1 text-text">Vimeo Transcript Fetcher</h1>
        <p className="text-body text-textMuted">Search your local archive instantly, or fetch new Vimeo transcripts.</p>
      </header>

      <ArchiveSearch onSelectResult={setSelectedTranscriptId} />

      <section className="grid gap-3 lg:grid-cols-[360px_1fr]">
        <section className="space-y-2 rounded-md border border-border bg-surface p-3">
          <h2 className="text-h3 text-text">Transcript library</h2>
          <TranscriptLibraryList
            items={library}
            selectedId={selectedTranscriptId}
            loading={libraryLoading}
            error={libraryError}
            onSelect={setSelectedTranscriptId}
          />
        </section>

        <section className="space-y-2 rounded-md border border-border bg-surface p-3">
          <h2 className="text-h3 text-text">Full transcript</h2>
          <TranscriptDetailViewer transcript={selectedTranscript} loading={detailLoading} error={detailError} />
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
