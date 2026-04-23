import prisma from '../lib/prisma.js';
import { safeJsonStringify, safeParseJsonObject } from '../utils/json.js';

function mapSource(source) {
  return {
    ...source,
    ingestSettings: safeParseJsonObject(source.ingestSettings, {}),
    metadata: safeParseJsonObject(source.metadataJson, {})
  };
}

export async function ensureSource({ platform, handle, displayName, sourceUrl, isActive = true, ingestSettings = {}, metadata = {} }) {
  const normalizedPlatform = `${platform}`.trim().toLowerCase();
  const normalizedHandle = `${handle}`.trim();

  const source = await prisma.source.upsert({
    where: {
      platform_handle: {
        platform: normalizedPlatform,
        handle: normalizedHandle
      }
    },
    update: {
      displayName,
      sourceUrl,
      isActive,
      ingestSettings: safeJsonStringify(ingestSettings, '{}'),
      metadataJson: safeJsonStringify(metadata, '{}')
    },
    create: {
      platform: normalizedPlatform,
      handle: normalizedHandle,
      displayName,
      sourceUrl,
      isActive,
      ingestSettings: safeJsonStringify(ingestSettings, '{}'),
      metadataJson: safeJsonStringify(metadata, '{}')
    }
  });

  return mapSource(source);
}

export async function listSources({ activeOnly = false } = {}) {
  const sources = await prisma.source.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ platform: 'asc' }, { handle: 'asc' }]
  });

  return sources.map(mapSource);
}

export async function updateSource(id, updates) {
  const source = await prisma.source.update({
    where: { id },
    data: {
      ...(updates.displayName ? { displayName: updates.displayName } : {}),
      ...(updates.sourceUrl ? { sourceUrl: updates.sourceUrl } : {}),
      ...(typeof updates.isActive === 'boolean' ? { isActive: updates.isActive } : {}),
      ...(updates.ingestSettings ? { ingestSettings: safeJsonStringify(updates.ingestSettings, '{}') } : {}),
      ...(updates.metadata ? { metadataJson: safeJsonStringify(updates.metadata, '{}') } : {})
    }
  });

  return mapSource(source);
}

export async function getSourceById(id) {
  const source = await prisma.source.findUnique({ where: { id } });
  return source ? mapSource(source) : null;
}
