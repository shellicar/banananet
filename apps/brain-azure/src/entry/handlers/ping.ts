import type { HttpHandler } from '@azure/functions';
import { pingSDK } from '@simple-claude-bot/brain-core/ping/pingSDK';
import type { PingResponse } from '@simple-claude-bot/shared/shared/types';
import { handleError } from '../../shared/handleError';
import { audit, sandboxConfig } from '../../shared/startup';

export const handler: HttpHandler = async () => {
  try {
    const result = await pingSDK(audit, sandboxConfig);
    return {
      jsonBody: { result } satisfies PingResponse,
    };
  } catch (error) {
    return handleError('/ping', error, { result: '' });
  }
};
