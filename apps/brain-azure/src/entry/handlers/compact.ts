import type { HttpHandler } from '@azure/functions';
import { compactSession } from '@simple-claude-bot/brain-core/compactSession';
import { logger } from '@simple-claude-bot/shared/logger';
import { CompactRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { CompactResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, sdkConfig } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    logger.info(`/compact: received request`);
    const body = CompactRequestSchema.parse(await parseJsonBody(request), { reportInput: true });
    const result = await compactSession(audit, sdkConfig, body.resumeSessionAt);
    logger.info(`/compact: complete`);
    return {
      jsonBody: { result } satisfies CompactResponse,
    };
  } catch (error) {
    return handleError('/compact', error, { result: '' });
  }
};
