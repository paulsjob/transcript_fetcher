function stripVttFormatting(text = '') {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTimestampSeconds(rawTimestamp = '') {
  const [clock] = rawTimestamp.trim().split('.');
  const millis = rawTimestamp.includes('.') ? Number.parseFloat(`0.${rawTimestamp.split('.')[1]}`) : 0;
  const parts = clock.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2] + millis;
  if (parts.length === 2) return parts[0] * 60 + parts[1] + millis;
  return null;
}

function formatTimestamp(rawTimestamp = '') {
  const [clock] = rawTimestamp.trim().split('.');
  const parts = clock.split(':');
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours === '00' ? `${minutes}:${seconds}` : `${hours}:${minutes}:${seconds}`;
  }
  return clock || rawTimestamp;
}

export function parseVtt(vttContent = '') {
  const normalized = vttContent.replace(/\r/g, '').replace(/^WEBVTT[^\n]*\n/i, '');
  const blocks = normalized.split(/\n\n+/);
  const segments = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length || lines[0].startsWith('NOTE')) continue;
    const timestampLine = lines.find((line) => line.includes('-->'));
    if (!timestampLine) continue;

    const [rawStart, rawEnd = ''] = timestampLine.split('-->').map((part) => part.trim().split(/\s+/)[0]);
    const text = stripVttFormatting(lines.filter((line) => !line.includes('-->') && !/^\d+$/.test(line)).join(' '));
    if (!text) continue;

    segments.push({
      start: formatTimestamp(rawStart),
      end: formatTimestamp(rawEnd),
      startSeconds: parseTimestampSeconds(rawStart),
      endSeconds: parseTimestampSeconds(rawEnd),
      text
    });
  }

  return segments;
}

export function transcriptTextFromSegments(segments = []) {
  return segments.map((segment) => segment.text).join('\n');
}

export function pickBestEnglishTextTrack(tracks = []) {
  const activeTracks = tracks.filter((track) => track?.link || track?.download_link);
  if (!activeTracks.length) return null;

  const englishTracks = activeTracks.filter((track) => {
    const language = String(track.language || track.language_code || '').toLowerCase();
    const name = String(track.name || '').toLowerCase();
    return language === 'en' || language.startsWith('en-') || name.includes('english');
  });

  const candidates = englishTracks.length ? englishTracks : activeTracks;
  return candidates.find((track) => String(track.type || '').toLowerCase().includes('caption'))
    || candidates.find((track) => String(track.type || '').toLowerCase().includes('subtitle'))
    || candidates[0];
}
