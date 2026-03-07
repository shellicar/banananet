import { randomUUID } from 'node:crypto';
import { logger } from '@simple-claude-bot/shared/logger';
import type { RespondRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type z from 'zod';
import type { AuditWriter } from './audit/auditLog';
import { postCallback } from './postCallback';
import { respondToMessages } from './respondToMessages';
import type { SdkConfig } from './types';

export async function processAndCallback(body: z.output<typeof RespondRequestSchema>, audit: AuditWriter, sdkConfig: SdkConfig, callbackHeaders: Record<string, string>): Promise<void> {
  const { callbackUrl } = body;

  await postCallback(callbackUrl, { type: 'typing' }, callbackHeaders);

  const typingInterval = setInterval(() => {
    postCallback(callbackUrl, { type: 'typing' }, callbackHeaders);
  }, 8000);

  try {
    const replies = await respondToMessages(audit, body, sdkConfig);
    await postCallback(callbackUrl, { type: 'message', replies }, callbackHeaders);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Background processing failed: ${errorMessage}`);

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
