import app from './app.js';
import prisma from './lib/prisma.js';
import { startChannelMonitorCron, parseBoolean } from './services/cronJob.js';
import { runArchiveBackfill } from './services/channelMonitorService.js';

const PORT = Number(process.env.PORT || 8787);

const server = app.listen(PORT, () => {
  console.log(`Transcript server listening on http://localhost:${PORT}`);
});

let monitorTask = null;

async function bootstrapArchiveIngestion() {
  const shouldBackfillOnStart = parseBoolean(process.env.ARCHIVE_BACKFILL_ON_START, true);

  if (!shouldBackfillOnStart) {
    console.log('Startup archive backfill disabled via ARCHIVE_BACKFILL_ON_START=false.');
    return;
  }

  console.log('Starting startup archive backfill pass...');

  try {
    await runArchiveBackfill();
  } catch (error) {
    console.error('Startup archive backfill failed:', error.message || error);
  }
}

(async () => {
  await bootstrapArchiveIngestion();
  monitorTask = startChannelMonitorCron();
})();

async function shutdown() {
  if (monitorTask) {
    monitorTask.stop();
  }

  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
