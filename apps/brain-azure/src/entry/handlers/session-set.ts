import type { HttpHandler } from '@azure/functions';
import { setSessionId } from '@simple-claude-bot/brain-core/session/setSessionId';
import { SessionSetRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { SessionResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../../shared/handleError';

export const handler: HttpHandler = async (request) => {
  try {
    const { sessionId } = SessionSetRequestSchema.parse(await parseJsonBody(request), { reportInput: true });
    setSessionId(sessionId);
    return {
      jsonBody: { sessionId } satisfies SessionResponse,
    };
  } catch (error) {
    return handleError('/session', error, { sessionId: null });
  }
};
