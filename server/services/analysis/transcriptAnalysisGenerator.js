import { generateProviderAnalysis } from './analysisProvider.js';

const STOPWORDS = new Set([
  'a', 'about', 'all', 'also', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'been', 'being', 'but',
  'by', 'can', 'do', 'for', 'from', 'had', 'has', 'have', 'if', 'in', 'into', 'is', 'it', 'its', 'just',
  'more', 'most', 'not', 'of', 'on', 'or', 'our', 'out', 'that', 'the', 'their', 'there', 'they', 'this',
  'to', 'up', 'was', 'we', 'were', 'what', 'when', 'which', 'who', 'will', 'with', 'you', 'your'
]);

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 40);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9'-]*/g)
    ?.filter((token) => token.length > 2 && !STOPWORDS.has(token)) || [];
}

function topTokens(sentences, maxCount = 12) {
  const tokenCounts = new Map();
  sentences.forEach((sentence) => {
    tokenize(sentence).forEach((token) => tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1));
  });

  return [...tokenCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, maxCount);
}

function scoreSentence(sentence, top) {
  const topSet = new Set(top);
  const tokens = tokenize(sentence);
  if (!tokens.length) {
    return 0;
  }

  const score = tokens.reduce((sum, token) => sum + (topSet.has(token) ? 2 : 0), 0);
  return score / tokens.length;
}

function buildFallbackSections(entries = []) {
  if (!entries.length) {
    return [];
  }

  const targetSections = Math.min(5, Math.max(3, Math.ceil(entries.length / 14)));
  const chunkSize = Math.ceil(entries.length / targetSections);
  const labels = ['Opening / setup', 'Main argument', 'Evidence / examples', 'Rebuttal / contrast', 'Closing'];

  const sections = [];

  for (let index = 0; index < targetSections; index += 1) {
    const chunk = entries.slice(index * chunkSize, (index + 1) * chunkSize);
    if (!chunk.length) {
      continue;
    }

    sections.push({
      label: labels[index] || `Section ${index + 1}`,
      startTimestamp: chunk[0]?.timestamp || null,
      endTimestamp: chunk[chunk.length - 1]?.timestamp || null,
      summary: chunk.slice(0, 2).map((entry) => entry.text).join(' ').slice(0, 220)
    });
  }

  return sections;
}

function buildFallbackQuotes(entries = []) {
  const longLines = entries.filter((entry) => entry.text.length > 90).slice(0, 8);
  const kinds = ['best_overall', 'best_emotional', 'best_policy', 'best_clip_ready'];

  return longLines.slice(0, 4).map((entry, index) => ({
    kind: kinds[index] || 'notable',
    quote: entry.text.slice(0, 320),
    timestamp: entry.timestamp || null,
    rationale: 'Selected for concise standalone clarity.'
  }));
}

function fallbackExtractiveAnalysis({ title, transcriptText, entries }) {
  const sentences = splitSentences(transcriptText);
  const rankedTokens = topTokens(sentences, 16);

  const rankedSentences = sentences
    .map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence, rankedTokens) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .sort((a, b) => a.index - b.index);

  const synopsis = rankedSentences.slice(0, 3).map((item) => item.sentence).join(' ').slice(0, 1000);
  const keyPoints = rankedSentences.slice(0, 6).map((item) => item.sentence);

  return {
    synopsis,
    keyPoints,
    entities: {
      people: [],
      organizations: [],
      places: [],
      programs: [],
      issues: rankedTokens.slice(0, 8)
    },
    tags: rankedTokens.slice(0, 12),
    sections: buildFallbackSections(entries),
    notableQuotes: buildFallbackQuotes(entries),
    source: 'extractive',
    title
  };
}

export async function generateStructuredAnalysis({ title, transcriptText, entries }) {
  const providerOutput = await generateProviderAnalysis({ title, transcriptText });
  if (providerOutput) {
    return providerOutput;
  }

  return fallbackExtractiveAnalysis({ title, transcriptText, entries });
}
