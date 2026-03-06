import type { HttpHandler } from '@azure/functions';
import { sendUnprompted } from '@simple-claude-bot/brain-core/unsolicited/sendUnprompted';
import { UnpromptedRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, sandboxConfig } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    const body = UnpromptedRequestSchema.parse(await parseJsonBody(request));
    const { replies, spoke } = await sendUnprompted(audit, body, sandboxConfig);
    return {
      jsonBody: { replies, spoke } satisfies UnpromptedResponse,
    };
  } catch (error) {
    return handleError('/unprompted', error, { replies: [], spoke: false });
  }
};
