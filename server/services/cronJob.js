import cron from 'node-cron';
import { runChannelMonitor } from './channelMonitorService.js';

const EVERY_12_HOURS = '0 */12 * * *';

function parseBoolean(value, defaultValue = false) {
  if (value == null) {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export function startChannelMonitorCron() {
  const monitorEnabled = parseBoolean(process.env.ARCHIVE_MONITOR_ON, true);
  const cronSchedule = process.env.ARCHIVE_MONITOR_CRON?.trim() || EVERY_12_HOURS;

  if (!monitorEnabled) {
    console.log('Channel monitor cron disabled via ARCHIVE_MONITOR_ON=false.');
    return null;
  }

  const task = cron.schedule(
    cronSchedule,
    async () => {
      try {
        await runChannelMonitor();
      } catch (error) {
        console.error('Channel monitor cron run failed:', error.message || error);
      }
    },
    {
      scheduled: true,
      timezone: 'UTC'
    }
  );

  console.log(`Channel monitor cron scheduled with expression "${cronSchedule}" (UTC).`);
  return task;
}

export { parseBoolean };
