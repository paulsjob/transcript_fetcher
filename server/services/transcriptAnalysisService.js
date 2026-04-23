const ANALYSIS_VERSION = 'v1-extractive';
const MIN_ANALYSIS_DURATION_SECONDS = 120;

const STOPWORDS = new Set([
  'a',
  'about',
  'all',
  'also',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'being',
  'but',
  'by',
  'can',
  'do',
  'for',
  'from',
  'had',
  'has',
  'have',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'just',
  'more',
  'most',
  'not',
  'of',
  'on',
  'or',
  'our',
  'out',
  'that',
  'the',
  'their',
  'there',
  'they',
  'this',
  'to',
  'up',
  'was',
  'we',
  'were',
  'what',
  'when',
  'which',
  'who',
  'will',
  'with',
  'you',
  'your'
]);

function clampItems(items, minimum, maximum) {
  if (!Array.isArray(items)) {
    return [];
  }

  const deduped = [...new Set(items.map((item) => `${item || ''}`.trim()).filter(Boolean))];
  return deduped.slice(0, Math.max(minimum, maximum));
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 30);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9'-]*/g)
    ?.filter((token) => token.length > 2 && !STOPWORDS.has(token)) || [];
}

function buildTermFrequency(sentences) {
  const terms = new Map();

  for (const sentence of sentences) {
    const tokens = tokenize(sentence);
    tokens.forEach((token) => terms.set(token, (terms.get(token) || 0) + 1));
  }

  return terms;
}

function scoreSentence(sentence, terms) {
  const tokens = tokenize(sentence);
  if (!tokens.length) {
    return 0;
  }

  const score = tokens.reduce((sum, token) => sum + (terms.get(token) || 0), 0);
  return score / tokens.length;
}

function titleToThemes(title = '') {
  return title
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 4)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
}

function buildThemesAndTags(sentences, title) {
  const tokenCounts = new Map();

  sentences.forEach((sentence) => {
    tokenize(sentence).forEach((token) => {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    });
  });

  const ranked = [...tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);

  const themes = clampItems([...titleToThemes(title), ...ranked.slice(0, 6).map((word) => word.replace(/(^\w)/, (m) => m.toUpperCase()))], 0, 6);
  const tags = clampItems(ranked.slice(0, 12), 0, 12);

  return { themes, tags };
}

function timestampToSeconds(timestamp) {
  if (typeof timestamp !== 'string') {
    return null;
  }

  const parts = timestamp.split(':').map((part) => Number.parseFloat(part));
  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  if (parts.length === 3) {
    return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }

  if (parts.length === 2) {
    return Math.round(parts[0] * 60 + parts[1]);
  }

  return null;
}

function buildNotableQuotes(transcript = []) {
  return transcript
    .filter((entry) => typeof entry?.text === 'string' && entry.text.length > 80)
    .slice(0, 3)
    .map((entry) => ({
      quote: entry.text.trim(),
      timestamp: entry.timestamp || null,
      timestampSeconds: timestampToSeconds(entry.timestamp)
    }));
}

function ensureAnalysisShape(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Transcript analysis output is not an object.');
  }

  const synopsis = `${candidate.synopsis || ''}`.trim();
  if (!synopsis) {
    throw new Error('Transcript analysis synopsis is required.');
  }

  const keyPoints = clampItems(candidate.keyPoints, 3, 8);
  const themes = clampItems(candidate.themes, 0, 8);
  const tags = clampItems(candidate.tags, 0, 16);
  const notableQuotes = Array.isArray(candidate.notableQuotes)
    ? candidate.notableQuotes
        .filter((item) => typeof item?.quote === 'string' && item.quote.trim())
        .slice(0, 3)
        .map((item) => ({
          quote: item.quote.trim(),
          timestamp: item.timestamp || null,
          timestampSeconds: Number.isFinite(item.timestampSeconds) ? item.timestampSeconds : null
        }))
    : [];

  return {
    synopsis,
    keyPoints,
    themes,
    tags,
    notableQuotes,
    analysisStatus: 'completed',
    analysisVersion: ANALYSIS_VERSION,
    analyzedAt: new Date()
  };
}

function buildExtractiveAnalysis({ title, transcript, transcriptText }) {
  const sentences = splitSentences(transcriptText || transcript.map((entry) => entry.text).join(' '));
  const terms = buildTermFrequency(sentences);

  const rankedSentences = sentences
    .map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence, terms) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .sort((a, b) => a.index - b.index);

  const synopsisSentences = rankedSentences.slice(0, 3).map((item) => item.sentence);
  const synopsis = synopsisSentences.join(' ').slice(0, 900);

  const keyPoints = rankedSentences
    .slice(0, 6)
    .map((item) => item.sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 8);

  const { themes, tags } = buildThemesAndTags(sentences, title);

  const notableQuotes = buildNotableQuotes(transcript);

  return {
    synopsis,
    keyPoints,
    themes,
    tags,
    notableQuotes
  };
}

export function shouldAnalyzeTranscript(durationSeconds) {
  return Number.isFinite(durationSeconds) && durationSeconds > MIN_ANALYSIS_DURATION_SECONDS;
}

export async function analyzeTranscript({ title, durationSeconds, transcript, transcriptText }) {
  if (!shouldAnalyzeTranscript(durationSeconds)) {
    return {
      analysisStatus: 'skipped',
      analysisVersion: ANALYSIS_VERSION,
      analyzedAt: new Date(),
      synopsis: null,
      keyPoints: [],
      themes: [],
      tags: [],
      notableQuotes: []
    };
  }

  const draft = buildExtractiveAnalysis({ title, transcript, transcriptText });
  return ensureAnalysisShape(draft);
}

export { ANALYSIS_VERSION, MIN_ANALYSIS_DURATION_SECONDS };
