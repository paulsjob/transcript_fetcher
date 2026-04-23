const ANALYSIS_VERSION = process.env.ANALYSIS_VERSION || 'v2-editorial';

function cleanString(value, maxLength = 500) {
  const text = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }

  return text.slice(0, maxLength);
}

function dedupeStrings(items = [], maxItems = 12, maxLength = 120) {
  if (!Array.isArray(items)) {
    return [];
  }

  return [...new Set(items.map((item) => cleanString(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function sanitizeEntities(entities = {}) {
  const source = entities && typeof entities === 'object' ? entities : {};
  return {
    people: dedupeStrings(source.people, 20),
    organizations: dedupeStrings(source.organizations, 20),
    places: dedupeStrings(source.places, 20),
    programs: dedupeStrings(source.programs, 20),
    issues: dedupeStrings(source.issues, 20)
  };
}

function sanitizeQuotes(notableQuotes = []) {
  if (!Array.isArray(notableQuotes)) {
    return [];
  }

  return notableQuotes
    .map((quoteItem) => ({
      kind: cleanString(quoteItem?.kind, 40) || 'notable',
      quote: cleanString(quoteItem?.quote, 320),
      timestamp: cleanString(quoteItem?.timestamp, 20) || null,
      rationale: cleanString(quoteItem?.rationale, 140) || null
    }))
    .filter((item) => item.quote)
    .slice(0, 6);
}

function sanitizeSections(sections = []) {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections
    .map((section) => ({
      label: cleanString(section?.label, 80),
      startTimestamp: cleanString(section?.startTimestamp, 20) || null,
      endTimestamp: cleanString(section?.endTimestamp, 20) || null,
      summary: cleanString(section?.summary, 240)
    }))
    .filter((section) => section.label && section.summary)
    .slice(0, 10);
}

export function validateAndNormalizeAnalysis(candidate = {}) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Analysis payload must be an object.');
  }

  const synopsis = cleanString(candidate.synopsis, 1200);
  const keyPoints = dedupeStrings(candidate.keyPoints, 8, 240);

  if (!synopsis) {
    throw new Error('Analysis synopsis is missing.');
  }

  if (keyPoints.length < 3) {
    throw new Error('Analysis key points must contain at least 3 entries.');
  }

  return {
    synopsis,
    keyPoints,
    entities: sanitizeEntities(candidate.entities),
    tags: dedupeStrings(candidate.tags, 24, 80),
    sections: sanitizeSections(candidate.sections),
    notableQuotes: sanitizeQuotes(candidate.notableQuotes),
    analysisStatus: 'completed',
    analysisVersion: ANALYSIS_VERSION,
    analyzedAt: new Date()
  };
}

export { ANALYSIS_VERSION };
