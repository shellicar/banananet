import { mkdirSync } from 'node:fs';
import { env } from 'node:process';
import { AuditWriter } from '@simple-claude-bot/brain-core/audit/auditLog';
import { brainSchema } from '@simple-claude-bot/brain-core/brainSchema';
import { initSessionPaths } from '@simple-claude-bot/brain-core/initSessionPaths';
import type { SdkConfig } from '@simple-claude-bot/brain-core/types';
import { createShutdownController } from '@simple-claude-bot/shared/createShutdownController';
import { logger } from '@simple-claude-bot/shared/logger';

const { CLAUDE_CONFIG_DIR, CLAUDE_SDK_CWD, CLAUDE_SDK_DEFAULT_MAXTURNS, CLAUDE_SDK_WORKSPACE_MAXTURNS, BOT_ALIASES, WORKSPACE_COMMANDS, AUDIT_DIR, CALLBACK_HEADERS } = brainSchema.parse(env, { reportInput: true });
initSessionPaths(CLAUDE_CONFIG_DIR);

export const audit = new AuditWriter(AUDIT_DIR);

export const callbackHeaders = CALLBACK_HEADERS;

export const sdkConfig = {
  cwd: CLAUDE_SDK_CWD,
  defaultMaxTurns: CLAUDE_SDK_DEFAULT_MAXTURNS,
  workspaceMaxTurns: CLAUDE_SDK_WORKSPACE_MAXTURNS,
  botAliases: BOT_ALIASES,
  workspaceCommands: WORKSPACE_COMMANDS,
} satisfies SdkConfig;

export const shutdown = createShutdownController({ delayBeforeAbort: 240_000, gracePeriod: 60_000 });

mkdirSync(sdkConfig.cwd, { recursive: true });
logger.info(`SdkConfig defaultMaxTurns=${sdkConfig.defaultMaxTurns} workspaceMaxTurns=${sdkConfig.workspaceMaxTurns} (cwd: ${sdkConfig.cwd})`);
