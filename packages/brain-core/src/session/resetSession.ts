import { existsSync, unlinkSync } from 'node:fs';
import { Instant } from '@js-joda/core';
import { logger } from '@simple-claude-bot/shared/logger';
import { BotCapability } from '@simple-claude-bot/shared/shared/platform/schema';
import { timestampFormatter } from '@simple-claude-bot/shared/timestampFormatter';
import { zone } from '@simple-claude-bot/shared/zone';
import type { AuditWriter } from '../audit/auditLog';
import { buildQueryOptions } from '../buildQueryOptions';
import { executeQuery } from '../executeQuery';
import { claudeGlobals } from '../globals';
import { buildSystemPrompt } from '../systemPrompts';
import type { ResetRequestOutput, SdkConfig } from '../types';
import { saveSession } from './saveSession';

export async function resetSession(audit: AuditWriter, body: ResetRequestOutput, sdkConfig: SdkConfig): Promise<string> {
  logger.info('Resetting session...');

  // Delete old session
  if (claudeGlobals.SESSION_FILE == null) {
    throw new Error('No session file');
  }
  if (existsSync(claudeGlobals.SESSION_FILE)) {
    unlinkSync(claudeGlobals.SESSION_FILE);
  }
  claudeGlobals.sessionId = undefined;

  logger.info(`Received ${body.messages.length} messages for session seeding`);

  if (body.messages.length === 0) {
    logger.warn('No messages found to seed session');
    return 'No messages found to seed session';
  }

  // Format messages as text with original display names
  const history = body.messages
    .map((m) => {
      const zdt = Instant.ofEpochMilli(m.createdTimestamp).atZone(zone);
      const prefix = m.authorIsBot ? '[BOT] ' : '';
      return `${prefix}[${zdt.format(timestampFormatter)}] ${m.authorDisplayName} (${m.authorId}): ${m.content}`;
    })
    .join('\n');

  const seedPrompt = `The following is recent message history from the Discord channel. Your response will NOT be sent to Discord. Internalise this context and summarise what you understand — who the users are, what they've been talking about, and any ongoing topics. Do NOT reply to or continue any of the conversations.\n\n${history}`;

  const systemPrompt = buildSystemPrompt({ type: 'reset' });

  const options = buildQueryOptions({
    systemPrompt,
    capabilities: { [BotCapability.Web]: false, [BotCapability.Workspace]: false },
    maxTurns: 10,
    sdkConfig,
    sessionId: undefined,
  });

  const result = await executeQuery(audit, '/reset', seedPrompt, options, saveSession);
  logger.info(`Session reset complete. New session: ${claudeGlobals.sessionId}. Response: ${result}`);
  return result;
}
