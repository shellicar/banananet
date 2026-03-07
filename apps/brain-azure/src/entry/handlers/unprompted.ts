import type { HttpHandler } from '@azure/functions';
import { sendUnprompted } from '@simple-claude-bot/brain-core/unsolicited/sendUnprompted';
import { UnpromptedRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, sdkConfig } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    const body = UnpromptedRequestSchema.parse(await parseJsonBody(request), { reportInput: true });
    const { replies, spoke } = await sendUnprompted(audit, body, sdkConfig);
    return {
      jsonBody: { replies, spoke } satisfies UnpromptedResponse,
    };
  } catch (error) {
    return handleError('/unprompted', error, { replies: [], spoke: false });
  }
};
