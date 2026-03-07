import { client, logger } from './logger';

export interface ShutdownOptions {
  readonly delayBeforeAbort: number;
  readonly gracePeriod: number;
}

export interface ShutdownController {
  readonly signal: AbortSignal;
  readonly controller: AbortController;
}

export const createShutdownController = (options: ShutdownOptions): ShutdownController => {
  const controller = new AbortController();

  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    client.flush();

    logger.warn(`Received ${signal}, starting graceful shutdown`, { component: 'lifecycle', delayBeforeAbort: options.delayBeforeAbort / 1000, gracePeriod: options.gracePeriod / 1000 });

    setTimeout(() => {
      logger.warn('Delay expired, aborting in-flight queries', { component: 'lifecycle' });
      controller.abort();

      setTimeout(() => {
        logger.error('Grace period expired, forcing exit', { component: 'lifecycle' });
        process.exit(1);
      }, options.gracePeriod).unref();
    }, options.delayBeforeAbort).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { signal: controller.signal, controller };
};
