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

/* Monkey-patch process.kill to block SIGTERM/SIGKILL to Claude Code subprocesses.
 * The SDK bypasses our SpawnedProcess.kill() wrapper and calls process.kill(pid) directly.
 * This intercepts at the only level that matters — the actual syscall wrapper. */
const protectedPids = new Set<number>();
const originalKill = process.kill.bind(process);
process.kill = ((pid: number, signal?: string | number) => {
  if (protectedPids.has(pid) && (signal === 'SIGTERM' || signal === 15 || signal === 'SIGKILL' || signal === 9)) {
    logger.info(`Blocked ${String(signal)} to protected pid=${pid}`, { component: 'lifecycle', pid });
    return true;
  }
  return originalKill(pid, signal as string);
}) as typeof process.kill;

function spawnProtected(options: SdkSpawnOptions): SpawnedProcess {
  logger.info(`spawnProtected: spawning ${options.command}`, { component: 'lifecycle' });
  const proc = spawn(options.command, options.args, {
    cwd: options.cwd,
    env: options.env as NodeJS.ProcessEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (proc.pid) {
    protectedPids.add(proc.pid);
    logger.info(`spawnProtected: spawned pid=${proc.pid}, added to protected set`, { component: 'lifecycle', pid: proc.pid });
  }
  proc.on('exit', (code, signal) => {
    if (proc.pid) {
      protectedPids.delete(proc.pid);
    }
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
      logger.info(`wrapper .kill(${signal}) called for pid=${proc.pid}`, { component: 'lifecycle', pid: proc.pid, signal });
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        logger.info(`Intercepted .kill(${signal}) on wrapper pid=${proc.pid}, ignoring`, { component: 'lifecycle', pid: proc.pid });
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
