import app from './app.js';
import prisma from './lib/prisma.js';
import { startChannelMonitorCron } from './services/cronJob.js';

const PORT = Number(process.env.PORT || 8787);

app.listen(PORT, () => {
  console.log(`Transcript server listening on http://localhost:${PORT}`);
});

const monitorTask = startChannelMonitorCron();

async function shutdown() {
  monitorTask.stop();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
