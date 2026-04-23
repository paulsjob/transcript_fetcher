const MIN_WORD_COUNT = Number.parseInt(process.env.ANALYSIS_MIN_WORD_COUNT || '120', 10);
const MIN_SEGMENT_COUNT = Number.parseInt(process.env.ANALYSIS_MIN_SEGMENT_COUNT || '6', 10);
const MIN_DURATION_SECONDS = Number.parseInt(process.env.ANALYSIS_MIN_DURATION_SECONDS || '90', 10);

function normalizeTranscriptEntries(transcript = []) {
  if (!Array.isArray(transcript)) {
    return [];
  }

  return transcript
    .map((entry) => ({
      timestamp: typeof entry?.timestamp === 'string' ? entry.timestamp : null,
      text: typeof entry?.text === 'string' ? entry.text.replace(/\s+/g, ' ').trim() : ''
    }))
    .filter((entry) => entry.text.length > 0);
}

export function prepareTranscriptForAnalysis({ transcript = [], transcriptText = '', durationSeconds = null }) {
  const entries = normalizeTranscriptEntries(transcript);
  const mergedText = `${transcriptText || entries.map((entry) => entry.text).join(' ')}`.replace(/\s+/g, ' ').trim();
  const words = mergedText ? mergedText.split(/\s+/).filter(Boolean) : [];

  const metadata = {
    segmentCount: entries.length,
    wordCount: words.length,
    charCount: mergedText.length,
    durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : null
  };

  if (!entries.length || !mergedText) {
    return {
      isEligible: false,
      reason: 'empty_transcript',
      entries,
      normalizedText: mergedText,
      metadata
    };
  }

  if (metadata.wordCount < MIN_WORD_COUNT) {
    return {
      isEligible: false,
      reason: 'too_short_words',
      entries,
      normalizedText: mergedText,
      metadata
    };
  }

  if (metadata.segmentCount < MIN_SEGMENT_COUNT) {
    return {
      isEligible: false,
      reason: 'too_few_segments',
      entries,
      normalizedText: mergedText,
      metadata
    };
  }

  if (Number.isFinite(metadata.durationSeconds) && metadata.durationSeconds < MIN_DURATION_SECONDS) {
    return {
      isEligible: false,
      reason: 'too_short_duration',
      entries,
      normalizedText: mergedText,
      metadata
    };
  }

  return {
    isEligible: true,
    reason: null,
    entries,
    normalizedText: mergedText,
    metadata
  };
}
