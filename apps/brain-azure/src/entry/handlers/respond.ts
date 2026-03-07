import type { HttpHandler } from '@azure/functions';
import { processAndCallback } from '@simple-claude-bot/brain-core/processAndCallback';
import { logger } from '@simple-claude-bot/shared/logger';
import { RespondRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, callbackHeaders, sdkConfig } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    logger.info(`/respond: received request`);
    const body = RespondRequestSchema.parse(await parseJsonBody(request), { reportInput: true });
    logger.info(`/respond: parsed ${body.messages.length} messages, callback=${body.callbackUrl}`);

    processAndCallback(body, audit, sdkConfig, callbackHeaders).catch((error) => logger.error(`/respond: unhandled error in background processing: ${error}`));

    return { status: 202 };
  } catch (error) {
    return handleError('/respond', error, { replies: [] });
  }
};
