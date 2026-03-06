import { logger } from '@simple-claude-bot/shared/logger';
import type { RespondRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type z from 'zod';
import type { AuditWriter } from './audit/auditLog';
import { postCallback } from './postCallback';
import { respondToMessages } from './respondToMessages';
import type { SandboxConfig } from './types';

export async function processAndCallback(body: z.output<typeof RespondRequestSchema>, audit: AuditWriter, sandboxConfig: SandboxConfig): Promise<void> {
  const { callbackUrl } = body;

  await postCallback(callbackUrl, { type: 'typing' });

  const typingInterval = setInterval(() => {
    postCallback(callbackUrl, { type: 'typing' });
  }, 8000);

  try {
    const replies = await respondToMessages(audit, body, sandboxConfig);
    await postCallback(callbackUrl, { type: 'message', replies });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Background processing failed: ${errorMessage}`);

    await postCallback(callbackUrl, {
      type: 'message',
      replies: [{ message: `⚠️ Something went wrong: ${errorMessage}` }],
    });
  } finally {
    clearInterval(typingInterval);
  }
}
