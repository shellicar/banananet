import type { HttpHandler } from '@azure/functions';
import { resetSession } from '@simple-claude-bot/brain-core/session/resetSession';
import { logger } from '@simple-claude-bot/shared/logger';
import { ResetRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { ResetResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, sdkConfig, shutdown } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    logger.info(`/reset: received request`);
    const body = ResetRequestSchema.parse(await parseJsonBody(request), { reportInput: true });
    logger.info(`/reset: ${body.messages.length} messages`);
    const result = await resetSession(audit, body, sdkConfig, shutdown.controller);
    logger.info(`/reset: complete`);
    return {
      jsonBody: { result } satisfies ResetResponse,
    };
  } catch (error) {
    return handleError('/reset', error, { result: '' });
  }
};
