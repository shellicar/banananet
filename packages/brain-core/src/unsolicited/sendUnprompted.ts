import { logger } from '@simple-claude-bot/shared/logger';
import type { Reply } from '@simple-claude-bot/shared/shared/types';
import type { AuditWriter } from '../audit/auditLog';
import { buildQueryOptions } from '../buildQueryOptions';
import { executeQuery } from '../executeQuery';
import { claudeGlobals } from '../globals';
import { parseResponse } from '../parseResponse';
import { saveSession } from '../session/saveSession';
import type { SdkConfig, UnpromptedRequestOutput } from '../types';

export async function sendUnprompted(audit: AuditWriter, body: UnpromptedRequestOutput, sdkConfig: SdkConfig): Promise<{ replies: Reply[]; spoke: boolean }> {
  try {
    logger.info(`Unprompted: ${body.prompt}`);

    const sdkOptions = buildQueryOptions({
      systemPrompt: body.systemPrompt,
      capabilities: body.capabilities,
      sdkConfig,
      sessionId: claudeGlobals.sessionId,
    });

    const result = await executeQuery(audit, '/unprompted', body.prompt, sdkOptions, saveSession);

    if (!result) {
      logger.warn('Empty unprompted response');
      return { replies: [], spoke: false };
    }

    const replies = parseResponse(result);
    return { replies, spoke: replies.length > 0 };
  } catch (error) {
    logger.error(`Error in unprompted message: ${error}`);
    return { replies: [], spoke: false };
  }
}
