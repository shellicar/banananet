import type { HttpHandler } from '@azure/functions';
import { compactSession } from '@simple-claude-bot/brain-core/compactSession';
import { CompactRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { CompactResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError, parseJsonBody } from '../../shared/handleError';
import { audit, sandboxConfig } from '../../shared/startup';

export const handler: HttpHandler = async (request) => {
  try {
    const body = CompactRequestSchema.parse(await parseJsonBody(request), { reportInput: true });
    const result = await compactSession(audit, sandboxConfig, body.resumeSessionAt);
    return {
      jsonBody: { result } satisfies CompactResponse,
    };
  } catch (error) {
    return handleError('/compact', error, { result: '' });
  }
};
