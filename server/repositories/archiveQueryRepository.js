import prisma from '../lib/prisma.js';
import { safeParseJsonArray, safeParseJsonObject } from '../utils/json.js';

function mapTranscriptRecord(record) {
  const entities = safeParseJsonObject(record.entitiesJson, {
    people: [],
    organizations: [],
    places: [],
    programs: [],
    issues: []
  });

  return {
    ...record,
    keyPoints: safeParseJsonArray(record.keyPointsJson),
    entities,
    tags: safeParseJsonArray(record.tagsJson),
    sections: safeParseJsonArray(record.sectionsJson),
    notableQuotes: safeParseJsonArray(record.notableQuotesJson)
  };
}

function normalizeText(value) {
  return `${value || ''}`.toLowerCase();
}

function getEntityValues(entities = {}) {
  return Object.values(entities)
    .flat()
    .filter(Boolean)
    .map((value) => `${value}`);
}

function getSearchableFields(record) {
  return {
    title: record.title || '',
    transcriptText: record.transcriptText || '',
    synopsis: record.synopsis || '',
    keyPointsJson: record.keyPointsJson || '',
    entitiesJson: record.entitiesJson || '',
    tagsJson: record.tagsJson || '',
    notableQuotesJson: record.notableQuotesJson || ''
  };
}

function snippetFromText(text, query, radius = 90) {
  if (!text) {
    return '';
  }

  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);
  const matchIndex = normalizedText.indexOf(normalizedQuery);

  if (matchIndex === -1) {
    return text.length > radius * 2 ? `${text.slice(0, radius * 2).trim()}…` : text;
  }

  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + query.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

function deriveMatchMetadata(record, query) {
  if (!query) {
    return { matchedFields: [], matchingTag: null, matchingEntity: null, matchingQuoteSnippet: null };
  }

  const normalizedQuery = normalizeText(query);
  const fields = getSearchableFields(record);
  const matchedFields = Object.entries(fields)
    .filter(([, value]) => normalizeText(value).includes(normalizedQuery))
    .map(([key]) => key);

  const matchingTag = (record.tags || []).find((tag) => normalizeText(tag).includes(normalizedQuery)) || null;
  const matchingEntity = getEntityValues(record.entities).find((entity) => normalizeText(entity).includes(normalizedQuery)) || null;

  const matchingQuote = (record.notableQuotes || []).find((quote) =>
    normalizeText(`${quote?.quote || ''} ${quote?.rationale || ''}`).includes(normalizedQuery)
  );

  return {
    matchedFields,
    matchingTag,
    matchingEntity,
    matchingQuoteSnippet: matchingQuote ? snippetFromText(matchingQuote.quote || '', query, 60) : null
  };
}

function filterByDuration(record, durationBucket) {
  if (!durationBucket || !record.durationSeconds) {
    return !durationBucket || durationBucket === 'any';
  }

  if (durationBucket === 'short') {
    return record.durationSeconds < 300;
  }

  if (durationBucket === 'medium') {
    return record.durationSeconds >= 300 && record.durationSeconds <= 1200;
  }

  if (durationBucket === 'long') {
    return record.durationSeconds > 1200;
  }

  return true;
}

function applyInMemoryFilters(records, filters) {
  const q = normalizeText(filters.q);
  const tag = normalizeText(filters.tag);
  const entity = normalizeText(filters.entity);

  return records.filter((record) => {
    if (q) {
      const fields = getSearchableFields(record);
      const hasQueryMatch = Object.values(fields).some((value) => normalizeText(value).includes(q));
      if (!hasQueryMatch) {
        return false;
      }
    }

    if (tag && !(record.tags || []).some((value) => normalizeText(value).includes(tag))) {
      return false;
    }

    if (entity && !getEntityValues(record.entities).some((value) => normalizeText(value).includes(entity))) {
      return false;
    }

    if (!filterByDuration(record, filters.durationBucket)) {
      return false;
    }

    if (filters.hasQuotes === 'true' && !(record.notableQuotes || []).length) {
      return false;
    }

    if (filters.hasQuotes === 'false' && (record.notableQuotes || []).length) {
      return false;
    }

    return true;
  });
}

function sortRecords(records, sortBy = 'fetchedAt', sortOrder = 'desc') {
  const order = sortOrder === 'asc' ? 1 : -1;

  return [...records].sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title) * order;
    }

    if (sortBy === 'durationSeconds') {
      return ((a.durationSeconds || 0) - (b.durationSeconds || 0)) * order;
    }

    return (new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime()) * order;
  });
}

export async function queryArchive(filters = {}) {
  const where = {
    ingestStatus: filters.ingestStatus ? filters.ingestStatus : { not: 'no_subtitles' }
  };

  if (filters.analysisStatus) {
    where.analysisStatus = filters.analysisStatus;
  }

  const coarseQuery = normalizeText(filters.q);
  if (coarseQuery) {
    where.OR = [
      { title: { contains: filters.q } },
      { transcriptText: { contains: filters.q } },
      { synopsis: { contains: filters.q } },
      { keyPointsJson: { contains: filters.q } },
      { entitiesJson: { contains: filters.q } },
      { tagsJson: { contains: filters.q } },
      { notableQuotesJson: { contains: filters.q } }
    ];
  }

  const rows = await prisma.transcript.findMany({
    where,
    select: {
      id: true,
      videoId: true,
      title: true,
      fetchedAt: true,
      durationSeconds: true,
      ingestStatus: true,
      ingestError: true,
      transcriptText: true,
      synopsis: true,
      keyPointsJson: true,
      entitiesJson: true,
      tagsJson: true,
      sectionsJson: true,
      notableQuotesJson: true,
      analysisStatus: true,
      analyzedAt: true,
      analysisVersion: true
    },
    take: 300
  });

  const mapped = rows.map(mapTranscriptRecord);
  const filtered = applyInMemoryFilters(mapped, filters);
  const sorted = sortRecords(filtered, filters.sortBy, filters.sortOrder);

  return sorted.map((record) => ({
    ...record,
    match: deriveMatchMetadata(record, filters.q)
  }));
}
