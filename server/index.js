import './config/env.js';
import app from './app.js';
import prisma from './lib/prisma.js';
import { readBoolean } from './config/env.js';
import { syncVimeoArchive } from './services/ingestService.js';

const PORT = Number(process.env.PORT || 8787);

const server = app.listen(PORT, () => {
  console.log(`Vimeo transcript archive server listening on http://localhost:${PORT}`);
});

if (readBoolean(process.env.VIMEO_SYNC_ON_START, false)) {
  syncVimeoArchive().catch((error) => {
    console.error('[vimeo-sync] Startup sync failed:', error.message || error);
  });
}

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
