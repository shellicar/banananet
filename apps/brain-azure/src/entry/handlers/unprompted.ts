import type { HttpHandler } from '@azure/functions';
import { sendUnprompted } from '@simple-claude-bot/brain-core/unsolicited/sendUnprompted';
import { logger } from '@simple-claude-bot/shared/logger';
import { UnpromptedRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, sdkConfig, shutdown } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    logger.info(`/unprompted: received request`);
    const body = UnpromptedRequestSchema.parse(await parseJsonBody(request), { reportInput: true });
    logger.info(`/unprompted: trigger=${body.trigger}`);
    const { replies, spoke } = await sendUnprompted(audit, body, sdkConfig, shutdown.controller);
    logger.info(`/unprompted: complete, spoke=${spoke}, replies=${replies.length}`);
    return {
      jsonBody: { replies, spoke } satisfies UnpromptedResponse,
    };
  } catch (error) {
    return handleError('/unprompted', error, { replies: [], spoke: false });
  }
};
