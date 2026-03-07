import versionInfo from '@shellicar/build-version/version';
import { logger } from '@simple-claude-bot/shared/logger';
import type { CallbackResponse, Reply } from '@simple-claude-bot/shared/shared/types';
import { z } from 'zod';
import type { BrainClient } from './brainClient';
import type { PlatformChannel } from './platform/types';
import { buildSystemPrompt } from './systemPrompts';

export interface CommandContext {
  brain: BrainClient;
  handle: { destroy(): void };
  dispatchReplies: (channel: PlatformChannel, replies: Reply[]) => Promise<CallbackResponse['delivered']>;
  stopWorkPlay: () => void;
  triggerWorkPlay: () => void;
  getProcessing(): Promise<void> | undefined;
  setProcessing(p: Promise<void>): void;
  getPlatformChannel(): PlatformChannel | undefined;
  getSystemPrompt(): string;
}

type CommandHandler = (ctx: CommandContext, args: string[]) => Promise<void>;

interface Command {
  sdk: boolean;
  channel: boolean;
  handler: CommandHandler;
}

const inputNumberSchema = z
  .string()
  .transform((val) => {
    const trimmed = val.trim();
    if (trimmed === '' || Number.isNaN(Number(trimmed))) {
      return val;
    }
    return Number(trimmed);
  })
  .pipe(z.number().int().min(1));

const resetCountSchema = inputNumberSchema.default(500);

async function handleShutdown(ctx: CommandContext, _args: string[]): Promise<void> {
  logger.info('Shutdown command received');
  ctx.stopWorkPlay();
  ctx.handle.destroy();
  process.exit(0);
}

async function handleVersion(_ctx: CommandContext, _args: string[]): Promise<void> {
  const dockerBuildTime = process.env.BANANABOT_BUILD_TIME;
  const dockerBuildHash = process.env.BANANABOT_BUILD_HASH;
  logger.info(`v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate} | docker: ${dockerBuildHash} built ${dockerBuildTime}`);
}

async function handleWorkplay(ctx: CommandContext, _args: string[]): Promise<void> {
  logger.info('WorkPlay manual trigger received');
  ctx.triggerWorkPlay();
}

async function handleHealth(ctx: CommandContext, _args: string[]): Promise<void> {
  logger.info('Health check command received');
  const response = await ctx.brain.health();
  logger.info(`Health: ${response.status}`);
}

async function handleSession(ctx: CommandContext, args: string[]): Promise<void> {
  const sessionArg = args.join(' ').trim();
  if (sessionArg) {
    logger.info(`Setting session to: ${sessionArg}`);
    const response = await ctx.brain.setSession(sessionArg);
    logger.info(`Session set to: ${response.sessionId}`);
  } else {
    const response = await ctx.brain.getSession();
    logger.info(`Current session: ${response.sessionId ?? 'none'}`);
  }
}

async function handlePrompt(ctx: CommandContext, _args: string[]): Promise<void> {
  logger.info('Prompt command received');
  const channel = ctx.getPlatformChannel();
  if (channel == null) {
    throw new Error('Platform channel not available');
  }
  const response = await ctx.brain.unprompted({
    prompt: 'Share a random interesting thought, fun fact, shower thought, or observation. Be concise and conversational.',
    systemPrompt: ctx.getSystemPrompt(),
  });
  if (response.spoke && response.replies.length > 0) {
    await ctx.dispatchReplies(channel, response.replies);
  }
}

async function handleCompact(ctx: CommandContext, args: string[]): Promise<void> {
  const resumeSessionAt = args[0]?.trim() || undefined;
  if (resumeSessionAt) {
    logger.info(`Compact-at command received: ${resumeSessionAt}`);
  } else {
    logger.info('Compact command received');
  }
  const response = await ctx.brain.compact(resumeSessionAt ? { resumeSessionAt } : {});
  if (response.error) {
    logger.error(`Compact error: ${response.error}`);
  } else {
    logger.info(`Compact result: ${response.result}`);
  }
}

async function handleReset(ctx: CommandContext, args: string[]): Promise<void> {
  const countParsed = resetCountSchema.safeParse(args[0], { reportInput: true });
  if (!countParsed.success) {
    logger.warn(`Invalid /reset argument: ${countParsed.error.message}`);
    return;
  }
  const count = countParsed.data;
  const channel = ctx.getPlatformChannel();
  if (channel == null) {
    throw new Error('Platform channel not available');
  }
  logger.info(`Reset command received (fetching ${count} messages)`);
  const messages = await channel.fetchHistory(count);
  const response = await ctx.brain.reset({ messages, systemPrompt: ctx.getSystemPrompt() });
  if (response.error) {
    logger.error(`Reset error: ${response.error}`);
  } else {
    logger.info(`Reset result: ${response.result}`);
  }
}

async function handlePing(ctx: CommandContext, _args: string[]): Promise<void> {
  logger.info('Ping command received');
  const response = await ctx.brain.ping();
  if (response.error) {
    logger.error(`Ping error: ${response.error}`);
  } else {
    logger.info(`Ping response: ${response.result}`);
  }
}

async function handleDirect(ctx: CommandContext, args: string[]): Promise<void> {
  const prompt = args.join(' ').trim();
  if (!prompt) {
    logger.warn('No prompt provided for /direct');
    return;
  }
  logger.info(`Direct query: ${prompt}`);
  const response = await ctx.brain.direct({
    prompt,
    systemPrompt: buildSystemPrompt({ type: 'direct' }),
  });
  if (response.error) {
    logger.error(`Direct query error: ${response.error}`);
  } else {
    logger.info(`Direct response: ${response.result}`);
  }
}

const commands: Record<string, Command> = {
  '/shutdown': { sdk: false, channel: false, handler: handleShutdown },
  '/version': { sdk: false, channel: false, handler: handleVersion },
  '/workplay': { sdk: false, channel: false, handler: handleWorkplay },
  '/health': { sdk: false, channel: false, handler: handleHealth },
  '/session': { sdk: false, channel: false, handler: handleSession },
  '/prompt': { sdk: true, channel: true, handler: handlePrompt },
  '/compact': { sdk: true, channel: false, handler: handleCompact },
  '/compact-at': { sdk: true, channel: false, handler: handleCompact },
  '/reset': { sdk: true, channel: true, handler: handleReset },
  '/ping': { sdk: true, channel: false, handler: handlePing },
  '/direct': { sdk: true, channel: false, handler: handleDirect },
};

export function dispatchCommand(ctx: CommandContext, line: string): void {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }

  const tokens = trimmed.split(/\s+/);
  const [name, ...args] = tokens;

  const command = commands[name];
  if (!command) {
    logger.warn(`Unknown command: ${trimmed}`);
    return;
  }

  if (command.channel && !ctx.getPlatformChannel()) {
    logger.warn('Bot channel not found yet');
    return;
  }

  if (command.sdk) {
    if (ctx.getProcessing()) {
      logger.warn(`Busy — ignoring ${name}`);
      return;
    }
    ctx.setProcessing(
      command.handler(ctx, args).catch((error) => {
        logger.error(`${name} error: ${error}`, error instanceof Error ? { cause: error.cause } : undefined);
      }),
    );
  } else {
    command.handler(ctx, args).catch((error) => {
      logger.error(`${name} error: ${error}`, error instanceof Error ? { cause: error.cause } : undefined);
    });
  }
}
