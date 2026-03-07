import { spawn } from 'node:child_process';
import type { CanUseTool, Options, PermissionResult, SpawnOptions as SdkSpawnOptions, SpawnedProcess } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@simple-claude-bot/shared/logger';
import { BotCapability } from '@simple-claude-bot/shared/shared/platform/schema';
import { claudePath, model, sdkHooks } from './consts';
import type { SdkConfig } from './types';

const WEB_TOOLS = ['WebSearch', 'WebFetch'];
const WORKSPACE_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task'];

const canUseTool: CanUseTool = async (_toolName, _input, options): Promise<PermissionResult> => {
  return {
    behavior: 'allow',
    toolUseID: options.toolUseID,
  };
};

function spawnProtected(options: SdkSpawnOptions): SpawnedProcess {
  logger.info(`spawnProtected: spawning ${options.command}`, { component: 'lifecycle', options });
  const proc = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: options.env as NodeJS.ProcessEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  logger.info(`spawnProtected: spawned pid=${proc.pid}`, { component: 'lifecycle', pid: proc.pid });
  proc.on('exit', (code, signal) => {
    logger.info(`spawnProtected: pid=${proc.pid} exited code=${code} signal=${signal}`, { component: 'lifecycle', pid: proc.pid, code, signal });
  });
  return {
    stdin: proc.stdin,
    stdout: proc.stdout,
    get killed() {
      return proc.killed;
    },
    get exitCode() {
      return proc.exitCode;
    },
    kill(signal: NodeJS.Signals) {
      if (signal === 'SIGTERM') {
        logger.info(`Intercepted SIGTERM to Claude Code subprocess pid=${proc.pid}, ignoring`, { component: 'lifecycle', pid: proc.pid });
        return true;
      }
      if (signal === 'SIGKILL') {
        logger.info(`Intercepted SIGKILL to Claude Code subprocess pid=${proc.pid}, ignoring`, { component: 'lifecycle', pid: proc.pid });
        return true;
      }
      return proc.kill(signal);
    },
    on: proc.on.bind(proc) as SpawnedProcess['on'],
    once: proc.once.bind(proc) as SpawnedProcess['once'],
    off: proc.off.bind(proc) as SpawnedProcess['off'],
  };
}

export function buildQueryOptions(params: { systemPrompt: string; capabilities?: Partial<Record<BotCapability, boolean>>; sdkConfig: SdkConfig; maxTurns?: number; sessionId?: string; abortController?: AbortController }): Options {
  const { systemPrompt, capabilities, sdkConfig, sessionId, abortController } = params;

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
    tools: {
      type: 'preset',
      preset: 'claude_code',
    },
    maxTurns,
    systemPrompt,
    settingSources: ['user'],
    canUseTool,
    stderr(data) {
      logger.error(data);
    },
    hooks: sdkHooks,
    // env: buildEnv(),
    ...(sessionId ? { resume: sessionId } : {}),
    abortController,
    spawnClaudeCodeProcess: spawnProtected,
  } satisfies Options;
}
