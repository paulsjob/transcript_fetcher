import { useState } from 'react';
import { fetchTranscript } from './api/transcript';
import TranscriptPanel from './components/TranscriptPanel';
import UrlInputForm from './components/UrlInputForm';

function App() {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError('');
    setTranscript([]);

    try {
      const data = await fetchTranscript(url);
      setTranscript(data);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background px-3 py-4">
      <header className="space-y-1">
        <h1 className="text-h1 text-text">Vimeo Transcript Fetcher</h1>
        <p className="text-body text-textMuted">Paste a public Vimeo link to extract subtitles with yt-dlp.</p>
      </header>

      <UrlInputForm url={url} onUrlChange={setUrl} onSubmit={handleSubmit} loading={loading} />
      <TranscriptPanel transcript={transcript} loading={loading} error={error} />
    </main>
  );
}

export default App;
