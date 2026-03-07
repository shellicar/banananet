import { app } from '@azure/functions';
import { client, logger } from '@simple-claude-bot/shared/logger';
import { shutdownController } from '../shared/startup';

logger.info('lifecycle: module loaded, registering hooks and signal handlers');

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

app.hook.appStart(() => {
  logger.info('appStart hook fired');
});

app.hook.appTerminate(async () => {
  logger.info('appTerminate hook fired');
  shutdownController.abort();
  client.flush();
  await delay(5000);
});
