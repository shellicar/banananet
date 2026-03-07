import { randomUUID } from 'node:crypto';
import { logger } from '@simple-claude-bot/shared/logger';
import type { RespondRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type z from 'zod';
import type { AuditWriter } from './audit/auditLog';
import { postCallback } from './postCallback';
import { respondToMessages } from './respondToMessages';
import type { SdkConfig } from './types';

export async function processAndCallback(body: z.output<typeof RespondRequestSchema>, audit: AuditWriter, sdkConfig: SdkConfig, callbackHeaders: Record<string, string>, abortController?: AbortController): Promise<void> {
  const { callbackUrl } = body;

  logger.info(`processAndCallback: starting, callbackUrl=${callbackUrl}`);
  await postCallback(callbackUrl, { type: 'typing' }, callbackHeaders);

  const typingInterval = setInterval(() => {
    postCallback(callbackUrl, { type: 'typing' }, callbackHeaders);
  }, 8000);

  try {
    const replies = await respondToMessages(audit, body, sdkConfig, abortController);
    logger.info(`processAndCallback: complete, ${replies.length} replies`);
    await postCallback(callbackUrl, { type: 'message', replies }, callbackHeaders);
    logger.info(`processAndCallback: callback sent`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`processAndCallback: failed: ${errorMessage}`);

    await postCallback(
      callbackUrl,
      {
        type: 'message',
        replies: [{ correlationId: randomUUID(), message: `⚠️ Something went wrong: ${errorMessage}` }],
      },
      callbackHeaders,
    );
  } finally {
    clearInterval(typingInterval);
  }
}
