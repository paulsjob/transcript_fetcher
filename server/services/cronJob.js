import cron from 'node-cron';
import { runChannelMonitor } from './channelMonitorService.js';

const EVERY_12_HOURS = '0 */12 * * *';

export function startChannelMonitorCron() {
  const channelUrl = process.env.VIMEO_CHANNEL_URL?.trim();

  const task = cron.schedule(
    EVERY_12_HOURS,
    async () => {
      try {
        await runChannelMonitor(channelUrl);
      } catch (error) {
        console.error('Channel monitor cron run failed:', error.message || error);
      }
    },
    {
      scheduled: true,
      timezone: 'UTC'
    }
  );

  console.log('Channel monitor cron scheduled for every 12 hours.');
  return task;
}
