import type { UUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@simple-claude-bot/shared/logger';
import type { AuditWriter } from './audit/auditLog';
import { claudePath, model } from './consts';
import { executeQuery } from './executeQuery';
import { claudeGlobals } from './globals';
import { saveSession } from './session/saveSession';
import type { SdkConfig } from './types';

export async function compactSession(audit: AuditWriter, sdkConfig: SdkConfig, resumeSessionAt?: UUID): Promise<string> {
  if (!claudeGlobals.sessionId) {
    logger.warn('No session to compact');
    return 'No session to compact';
  }

  logger.info(`Compacting session ${claudeGlobals.sessionId}...${resumeSessionAt ? ` at ${resumeSessionAt}` : ''}`);

  const options = {
    pathToClaudeCodeExecutable: claudePath,
    model,
    cwd: sdkConfig.cwd,
    allowedTools: [] as string[],
    maxTurns: 1,
    resume: claudeGlobals.sessionId,
    ...(resumeSessionAt ? { resumeSessionAt } : {}),
  } satisfies Options;

  const result = await executeQuery(audit, '/compact', '/compact', options, saveSession);

  if (claudeGlobals.COMPACT_FILE == null) {
    throw new Error('No compact file');
  }
  writeFileSync(claudeGlobals.COMPACT_FILE, result);
  logger.info(`Compact result saved to ${claudeGlobals.COMPACT_FILE} (${result.length} chars)`);
  return result;
}
