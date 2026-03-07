import type { HttpHandler } from '@azure/functions';
import { directQuery } from '@simple-claude-bot/brain-core/directQuery';
import { logger } from '@simple-claude-bot/shared/logger';
import { DirectRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { DirectResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, sdkConfig, shutdown } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    logger.info(`/direct: received request`);
    const body = DirectRequestSchema.parse(await parseJsonBody(request), { reportInput: true });
    const result = await directQuery(audit, body, sdkConfig, shutdown.controller);
    logger.info(`/direct: complete`);
    return {
      jsonBody: { result } satisfies DirectResponse,
    };
  } catch (error) {
    return handleError('/direct', error, { result: '' });
  }
};
