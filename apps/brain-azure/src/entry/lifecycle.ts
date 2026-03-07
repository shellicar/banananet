import { appendFileSync } from 'node:fs';
import { app } from '@azure/functions';
import { client, logger } from '@simple-claude-bot/shared/logger';
import { shutdown } from '../shared/startup';

logger.info('lifecycle: module loaded, registering hooks');

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

app.hook.appStart(() => {
  appendFileSync('/sandbox/app.hooks', `start: ${new Date().toISOString()}\n`);
  logger.info('appStart hook fired');
});

app.hook.appTerminate(async () => {
  appendFileSync('/sandbox/app.hooks', `terminate: ${new Date().toISOString()}\n`);
  logger.info('appTerminate hook fired');
  shutdown.controller.abort();
  client.flush();
  await delay(5000);
});
