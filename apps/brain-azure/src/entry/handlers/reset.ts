import type { HttpHandler } from '@azure/functions';
import { resetSession } from '@simple-claude-bot/brain-core/session/resetSession';
import { ResetRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { ResetResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, sandboxConfig } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    const body = ResetRequestSchema.parse(await parseJsonBody(request), { reportInput: true });
    const result = await resetSession(audit, body, sandboxConfig);
    return {
      jsonBody: { result } satisfies ResetResponse,
    };
  } catch (error) {
    return handleError('/reset', error, { result: '' });
  }
};
