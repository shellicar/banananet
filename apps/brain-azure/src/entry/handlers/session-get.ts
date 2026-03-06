import type { HttpHandler } from '@azure/functions';
import { getSessionId } from '@simple-claude-bot/brain-core/getSessionId';
import type { SessionResponse } from '@simple-claude-bot/shared/shared/types';

export const handler: HttpHandler = async () => {
  const sessionId = getSessionId() ?? null;
  return {
    jsonBody: { sessionId } satisfies SessionResponse,
  };
};
