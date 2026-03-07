import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@simple-claude-bot/shared/logger';
import type { Reply } from '@simple-claude-bot/shared/shared/types';
import type { AuditWriter } from './audit/auditLog';
import { buildContentBlocks } from './buildContentBlocks';
import { buildQueryOptions } from './buildQueryOptions';
import { executeQuery } from './executeQuery';
import { claudeGlobals } from './globals';
import { parseResponse } from './parseResponse';
import { saveSession } from './session/saveSession';
import { buildSystemPrompt } from './systemPrompts';
import type { RespondRequestOutput, SdkConfig } from './types';

export async function respondToMessages(audit: AuditWriter, body: RespondRequestOutput, sdkConfig: SdkConfig, abortController?: AbortController): Promise<Reply[]> {
  const contentBlocks = buildContentBlocks(body.messages);
  const hasImages = contentBlocks.some((b) => b.type === 'image');

  const promptText = contentBlocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  logger.info(`Prompt: ${promptText}`);

  const prompt = hasImages
    ? (async function* () {
        yield {
          type: 'user',
          message: {
            role: 'user',
            content: contentBlocks,
          },
          parent_tool_use_id: null,
          session_id: claudeGlobals.sessionId ?? '',
        } satisfies SDKUserMessage;
      })()
    : promptText;

  const systemPrompt = buildSystemPrompt({
    type: 'discord',
    workspaceEnabled: body.capabilities?.WORKSPACE ?? true,
    workspaceCommands: sdkConfig.workspaceCommands,
    botUserId: body.botUserId,
    botUsername: body.botUsername,
    botAliases: sdkConfig.botAliases,
  });

  const options = buildQueryOptions({
    systemPrompt,
    capabilities: body.capabilities,
    sdkConfig,
    sessionId: claudeGlobals.sessionId,
    abortController,
  });

  const result = await executeQuery(audit, '/respond', prompt, options, saveSession);

  if (!result) {
    logger.warn('Empty response from Claude');
    return [];
  }

  return parseResponse(result);
}
