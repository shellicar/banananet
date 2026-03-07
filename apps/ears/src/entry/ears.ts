import versionInfo from '@shellicar/build-version/version';
import { createEarsApp } from '@simple-claude-bot/ears-core/earsApp';
import { earsSchema } from '@simple-claude-bot/ears-core/earsSchema';
import { createShutdownController } from '@simple-claude-bot/shared/createShutdownController';
import { logger } from '@simple-claude-bot/shared/logger';
import { createCommandReader } from '../createCommandReader';
import { createHono } from '../createHono';

const main = async () => {
  logger.info(`Starting ears v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate}`);

  const { signal } = createShutdownController({ delayBeforeAbort: 0, gracePeriod: 5_000 });
  const config = earsSchema.parse(process.env, { reportInput: true });
  const earsApp = createEarsApp(config, signal);
  createHono(earsApp, config.CONTAINER_APP_PORT, signal);
  createCommandReader(earsApp.commandContext, signal);
};

await main();
