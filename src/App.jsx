import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchTranscriptText, fetchUserVideos, fetchVideoTextTracks, normalizeTranscriptText } from './api/vimeo';
import LayoutShell from './components/LayoutShell';
import TokenConfig from './components/TokenConfig';
import TranscriptView from './components/TranscriptView';
import VideoList from './components/VideoList';

function App() {
  const [tokenInput, setTokenInput] = useState('');

  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState('');

  const [selectedVideo, setSelectedVideo] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState('');

  const [activeTrackId, setActiveTrackId] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');

  const selectedVideoId = useMemo(() => selectedVideo?.id ?? '', [selectedVideo]);

  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    setVideosError('');
    setSelectedVideo(null);
    setTracks([]);
    setTranscriptText('');

    try {
      const nextVideos = await fetchUserVideos(tokenInput);
      setVideos(nextVideos);
    } catch (error) {
      setVideos([]);
      setVideosError(error.message);
    } finally {
      setVideosLoading(false);
    }
  }, [tokenInput]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleSelectVideo = useCallback(
    async (video) => {
      setSelectedVideo(video);
      setTracksLoading(true);
      setTracksError('');
      setTracks([]);
      setActiveTrackId('');
      setTranscriptText('');
      setTranscriptError('');

      try {
        const nextTracks = await fetchVideoTextTracks(video.id, tokenInput);
        setTracks(nextTracks);
      } catch (error) {
        setTracksError(error.message);
      } finally {
        setTracksLoading(false);
      }
    },
    [tokenInput]
  );

  const handleSelectTrack = useCallback(
    async (track) => {
      setActiveTrackId(track.id);
      setTranscriptLoading(true);
      setTranscriptError('');
      setTranscriptText('');

      try {
        const rawTranscript = await fetchTranscriptText(track.link, tokenInput);
        setTranscriptText(normalizeTranscriptText(rawTranscript));
      } catch (error) {
        setTranscriptError(error.message);
      } finally {
        setTranscriptLoading(false);
      }
    },
    [tokenInput]
  );

  return (
    <LayoutShell>
      <TokenConfig
        tokenInput={tokenInput}
        onTokenInput={setTokenInput}
        onReloadVideos={loadVideos}
        disabled={videosLoading}
      />
      <VideoList
        videos={videos}
        activeVideoId={selectedVideoId}
        onSelectVideo={handleSelectVideo}
        loading={videosLoading}
        error={videosError}
      />
      <TranscriptView
        selectedVideo={selectedVideo}
        loadingTracks={tracksLoading}
        tracksError={tracksError}
        tracks={tracks}
        activeTrackId={activeTrackId}
        onSelectTrack={handleSelectTrack}
        loadingTranscript={transcriptLoading}
        transcriptText={transcriptText}
        transcriptError={transcriptError}
      />
    </LayoutShell>
  );
}

export default App;
