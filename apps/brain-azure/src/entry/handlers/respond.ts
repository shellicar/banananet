import type { HttpHandler } from '@azure/functions';
import { processAndCallback } from '@simple-claude-bot/brain-core/processAndCallback';
import { logger } from '@simple-claude-bot/shared/logger';
import { RespondRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, sandboxConfig } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    const body = RespondRequestSchema.parse(await parseJsonBody(request));

    processAndCallback(body, audit, sandboxConfig).catch((error) => logger.error(`Unhandled error in background processing: ${error}`));

    return { status: 202 };
  } catch (error) {
    return handleError('/respond', error, { replies: [] });
  }
};
