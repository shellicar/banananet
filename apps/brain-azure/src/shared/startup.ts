import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from 'node:process';
import { AuditWriter } from '@simple-claude-bot/brain-core/audit/auditLog';
import { brainSchema } from '@simple-claude-bot/brain-core/brainSchema';
import { initSessionPaths } from '@simple-claude-bot/brain-core/initSessionPaths';
import type { SandboxConfig } from '@simple-claude-bot/brain-core/types';
import { logger } from '@simple-claude-bot/shared/logger';

const { CLAUDE_CONFIG_DIR, SANDBOX_ENABLED, SANDBOX_DIR, AUDIT_DIR, CALLBACK_HEADERS } = brainSchema.parse(env);
initSessionPaths(CLAUDE_CONFIG_DIR);

export const audit = new AuditWriter(AUDIT_DIR);

export const callbackHeaders = CALLBACK_HEADERS;

export const sandboxConfig = {
  enabled: SANDBOX_ENABLED,
  directory: resolve(SANDBOX_DIR),
} satisfies SandboxConfig;

mkdirSync(sandboxConfig.directory, { recursive: true });
logger.info(`Sandbox ${sandboxConfig.enabled ? 'enabled' : 'disabled'} (cwd: ${sandboxConfig.directory})`);
