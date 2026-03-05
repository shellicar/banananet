import { createInterface } from 'node:readline';
import { setTimeout } from 'node:timers/promises';
import versionInfo from '@shellicar/build-version/version';
import { logger } from '@simple-claude-bot/shared/logger';
import type { ParsedReply } from '@simple-claude-bot/shared/shared/types';
import { BrainClient } from '../brainClient';
import { CallbackServer } from '../callbackServer';
import type { CommandContext } from '../commands';
import { dispatchCommand } from '../commands';
import { earsSchema } from '../earsSchema';
import { startDiscord } from '../platform/discord/startDiscord';
import type { PlatformChannel } from '../platform/types';
import { buildSystemPrompt } from '../systemPrompts';
import type { PlatformMessageInput } from '../types';
import { resetActivity, seedActivity, startWorkPlay, stopWorkPlay, triggerWorkPlay } from '../workplay.js';

const main = async () => {
  const dockerBuildTime = process.env.BANANABOT_BUILD_TIME;
  const dockerBuildHash = process.env.BANANABOT_BUILD_HASH;
  logger.info(`Starting ears v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate} | docker: ${dockerBuildHash} built ${dockerBuildTime}`);

  let processing: Promise<void> | undefined;
  const messageQueue: PlatformMessageInput[] = [];

  const { DISCORD_TOKEN, DISCORD_GUILD, CLAUDE_CHANNEL, BOT_ALIASES, BRAIN_URL, BRAIN_KEY, SANDBOX_ENABLED, SANDBOX_COMMANDS, CALLBACK_PORT, CALLBACK_HOST } = earsSchema.parse(process.env, { reportInput: true });

  const brain = new BrainClient(BRAIN_URL, BRAIN_KEY);
  const sandboxEnabled = SANDBOX_ENABLED;
  const botAliases = BOT_ALIASES;

  let platformChannel: PlatformChannel | undefined;
  let systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: sandboxEnabled, sandboxCommands: SANDBOX_COMMANDS, botAliases });

  async function dispatchReplies(channel: PlatformChannel, replies: ParsedReply[], messages?: PlatformMessageInput[]): Promise<void> {
    const messagesByUserId = new Map<string, PlatformMessageInput>();
    if (messages) {
      for (const m of messages) {
        messagesByUserId.set(m.authorId, m);
      }
    }

    for (const reply of replies) {
      if (reply.delay) {
        logger.debug(`Delaying ${reply.delay}ms before next message`);
        await setTimeout(reply.delay);
      }

      const target = reply.replyTo && reply.ping ? messagesByUserId.get(reply.replyTo) : undefined;

      if (target) {
        await channel.replyTo(target, reply.message);
      } else {
        await channel.sendMessage(reply.message);
      }
    }
  }

  // Callback server — receives typing heartbeats and message deliveries from Brain
  const callbackServer = new CallbackServer({
    port: CALLBACK_PORT,
    host: CALLBACK_HOST,
    dispatchReplies,
  });
  callbackServer.start();

  const processQueue = async (channel: PlatformChannel) => {
    while (messageQueue.length > 0) {
      const batch = messageQueue.splice(0);
      for (const m of batch) {
        channel.trackMessage(m);
      }

      try {
        const { callbackUrl, completed } = callbackServer.createCallback(channel, batch);
        await brain.respondAsync({ messages: batch, systemPrompt, allowedTools: ['WebSearch', 'WebFetch'], callbackUrl });
        // Brain accepted (202) — wait for the message callback before processing next batch
        await completed;
      } catch (error) {
        logger.error(`Error sending to brain: ${error}`, error instanceof Error ? { cause: error.cause } : undefined);
        await channel.sendMessage('Sorry, I encountered an error processing your message.');
        channel.clearTracked();
      }
    }
  };

  const handle = startDiscord({ guildId: DISCORD_GUILD, channelName: CLAUDE_CHANNEL }, DISCORD_TOKEN, {
    onReady: (info) => {
      systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: sandboxEnabled, sandboxCommands: SANDBOX_COMMANDS, botUserId: info.botUserId, botUsername: info.botUsername, botAliases });
      logger.debug(`System prompt: ${systemPrompt}`);
      platformChannel = info.channel;
      if (info.lastMessageTimestamp) {
        seedActivity(info.lastMessageTimestamp);
      }
      startWorkPlay({
        sandboxEnabled,
        onIdle: async (prompt, options) => {
          const response = await brain.unprompted({ prompt, systemPrompt, allowedTools: options.allowedTools, maxTurns: options.maxTurns });
          if (response.spoke && response.replies.length > 0 && platformChannel) {
            await dispatchReplies(platformChannel, response.replies);
          }
          return { replies: response.replies, spoke: response.spoke };
        },
        isProcessing: () => processing !== undefined,
        setProcessing: (p) => {
          processing = p.finally(() => {
            processing = undefined;
          });
        },
        setPresence: (status) => handle.setPresence(status),
      });
    },
    onMessage: (message) => {
      resetActivity();
      messageQueue.push(message);
      if (processing || !platformChannel) {
        return;
      }
      processing = processQueue(platformChannel).finally(() => {
        processing = undefined;
        resetActivity();
      });
    },
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    stopWorkPlay();
    callbackServer.stop();
    handle.destroy();
    logger.info('Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  const commandCtx = {
    brain,
    handle,
    dispatchReplies,
    stopWorkPlay,
    triggerWorkPlay,
    getProcessing: () => processing,
    setProcessing: (p) => {
      processing = p.finally(() => {
        processing = undefined;
      });
    },
    getPlatformChannel: () => platformChannel,
    getSystemPrompt: () => systemPrompt,
  } satisfies CommandContext;

  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => dispatchCommand(commandCtx, line));
};

await main();
