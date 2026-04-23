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

function getSearchableFields(record) {
  return [record.title || '', record.transcriptText || '', record.synopsis || ''];
}

function applyInMemoryFilters(records, filters) {
  const q = normalizeText(filters.q);

  return records.filter((record) => {
    if (!q) {
      return true;
    }

    return getSearchableFields(record).some((value) => normalizeText(value).includes(q));
  });
}

function sortRecords(records, sortBy = 'fetchedAt', sortOrder = 'desc') {
  const order = sortOrder === 'asc' ? 1 : -1;

  return [...records].sort((a, b) => {
    if (sortBy === 'title') {
      return a.title.localeCompare(b.title) * order;
    }

    return (new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime()) * order;
  });
}

export async function queryArchive(filters = {}) {
  const where = {
    ingestStatus: { not: 'no_subtitles' }
  };

  const coarseQuery = normalizeText(filters.q);
  if (coarseQuery) {
    where.OR = [
      { title: { contains: filters.q } },
      { transcriptText: { contains: filters.q } },
      { synopsis: { contains: filters.q } }
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
    match: {
      matchedFields: [],
      matchingTag: null,
      matchingEntity: null,
      matchingQuoteSnippet: null
    }
  }));
}
