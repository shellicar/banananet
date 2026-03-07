import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { BotCapability } from '@simple-claude-bot/shared/shared/platform/schema';
import { buildEnv } from './buildEnv';
import { claudePath, model, sdkHooks } from './consts';
import type { SdkConfig } from './types';

const WEB_TOOLS = ['WebSearch', 'WebFetch'];
const WORKSPACE_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'];

export function buildQueryOptions(params: { systemPrompt: string; capabilities?: Partial<Record<BotCapability, boolean>>; sdkConfig: SdkConfig; maxTurns?: number; sessionId?: string }): Options {
  const { systemPrompt, capabilities, sdkConfig, sessionId } = params;

  const webEnabled = capabilities?.[BotCapability.Web] ?? true;
  const workspaceEnabled = capabilities?.[BotCapability.Workspace] ?? true;

  const allowedTools: string[] = [];
  if (webEnabled) {
    allowedTools.push(...WEB_TOOLS);
  }
  if (workspaceEnabled) {
    allowedTools.push(...WORKSPACE_TOOLS);
  }

  const maxTurns = params.maxTurns ?? (workspaceEnabled ? sdkConfig.workspaceMaxTurns : sdkConfig.defaultMaxTurns);

  return {
    pathToClaudeCodeExecutable: claudePath,
    model,
    cwd: sdkConfig.cwd,
    allowedTools,
    tools: allowedTools,
    maxTurns,
    systemPrompt,
    settingSources: ['user'],
    hooks: sdkHooks,
    env: buildEnv(),
    ...(sessionId ? { resume: sessionId } : {}),
  } satisfies Options;
}
