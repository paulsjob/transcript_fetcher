function stripVttFormatting(text = '') {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTimestamp(rawTimestamp = '') {
  const [clock] = rawTimestamp.trim().split('.');
  const parts = clock.split(':');

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours === '00' ? `${minutes}:${seconds}` : `${hours}:${minutes}:${seconds}`;
  }

  if (parts.length === 2) {
    return clock;
  }

  return rawTimestamp;
}

export function parseVttToTranscript(vttContent = '') {
  const normalized = vttContent.replace(/\r/g, '');
  const blocks = normalized.split(/\n\n+/);
  const transcript = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length || lines[0] === 'WEBVTT') {
      continue;
    }

    const timestampLine = lines.find((line) => line.includes('-->'));
    if (!timestampLine) {
      continue;
    }

    const [start] = timestampLine.split('-->');
    const textLines = lines.filter((line) => !line.includes('-->') && !/^\d+$/.test(line));
    const text = stripVttFormatting(textLines.join(' '));

    if (!text) {
      continue;
    }

    transcript.push({
      timestamp: formatTimestamp(start),
      text
    });
  }

  return transcript;
}
