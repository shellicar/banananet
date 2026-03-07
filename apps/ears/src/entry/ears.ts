import { createInterface } from 'node:readline';
import { setTimeout } from 'node:timers/promises';
import { serve } from '@hono/node-server';
import versionInfo from '@shellicar/build-version/version';
import { BrainClient } from '@simple-claude-bot/ears-core/brainClient';
import { CallbackManager } from '@simple-claude-bot/ears-core/callbackManager';
import type { CommandContext } from '@simple-claude-bot/ears-core/commands';
import { dispatchCommand } from '@simple-claude-bot/ears-core/commands';
import { earsSchema } from '@simple-claude-bot/ears-core/earsSchema';
import { startDiscord } from '@simple-claude-bot/ears-core/platform/discord/startDiscord';
import type { PlatformChannel } from '@simple-claude-bot/ears-core/platform/types';
import { buildSystemPrompt } from '@simple-claude-bot/ears-core/systemPrompts';
import type { PlatformMessageInput } from '@simple-claude-bot/ears-core/types';
import { resetActivity, seedActivity, startWorkPlay, stopWorkPlay, triggerWorkPlay } from '@simple-claude-bot/ears-core/workplay';
import { logger } from '@simple-claude-bot/shared/logger';
import { CallbackRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { CallbackResponse, Reply } from '@simple-claude-bot/shared/shared/types';
import { Hono } from 'hono';
import { z } from 'zod';

const main = async () => {
  logger.info(`Starting ears v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate}`);

  let processing: Promise<void> | undefined;
  const messageQueue: PlatformMessageInput[] = [];

  const { DISCORD_TOKEN, DISCORD_GUILD, CLAUDE_CHANNEL, BOT_ALIASES, BRAIN_URL, BRAIN_KEY, SANDBOX_ENABLED, SANDBOX_COMMANDS, CALLBACK_PORT, CALLBACK_HOST } = earsSchema.parse(process.env, { reportInput: true });

  const brain = new BrainClient(BRAIN_URL, BRAIN_KEY);
  const sandboxEnabled = SANDBOX_ENABLED;
  const botAliases = BOT_ALIASES;

  let platformChannel: PlatformChannel | undefined;
  let systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: sandboxEnabled, sandboxCommands: SANDBOX_COMMANDS, botAliases });

  function calculateTypingDelay(message: string): number {
    return 100 + message.length * 30;
  }

  async function dispatchReplies(channel: PlatformChannel, replies: Reply[], messages?: PlatformMessageInput[]): Promise<CallbackResponse['delivered']> {
    const messagesByUserId = new Map<string, PlatformMessageInput>();
    if (messages) {
      for (const m of messages) {
        messagesByUserId.set(m.authorId, m);
      }
    }

    const delivered: CallbackResponse['delivered'] = [];
    for (let i = 0; i < replies.length; i++) {
      const reply = replies[i];

      if (i > 0) {
        const delay = calculateTypingDelay(reply.message);
        logger.debug(`Typing delay ${delay}ms before reply ${i + 1}/${replies.length}`);
        await setTimeout(delay);
      }

      const target = reply.replyTo && reply.ping ? messagesByUserId.get(reply.replyTo) : undefined;
      const sent = target ? await channel.replyTo(target, reply.message) : await channel.sendMessage(reply.message);

      for (const s of sent) {
        delivered.push({
          discordMessageId: s.id,
          correlationId: reply.correlationId,
          timestamp: new Date(s.timestamp).toISOString(),
          message: s.message,
        });
      }
    }
    return delivered;
  }

  // Callback manager — tracks pending requests for async brain responses
  const callbackManager = new CallbackManager(CALLBACK_HOST);
  callbackManager.startCleanup();

  // Callback HTTP server — receives typing heartbeats and message deliveries from Brain
  const app = new Hono();

  app.get('/', (c) => c.json({ status: 'ok' }));

  app.post('/callback/:requestId', async (c) => {
    const requestId = c.req.param('requestId');
    if (!z.uuid().safeParse(requestId).success) {
      return c.body(null, 400);
    }

    const context = callbackManager.get(requestId);
    if (!context) {
      logger.warn(`Callback for unknown request ${requestId}`);
      return c.body(null, 404);
    }

    const payload = CallbackRequestSchema.parse(await c.req.json());

    switch (payload.type) {
      case 'typing': {
        await context.channel.sendTyping();
        return c.json({});
      }

      case 'message': {
        try {
          const delivered = await dispatchReplies(context.channel, payload.replies, context.messages);
          return c.json({ delivered } satisfies CallbackResponse);
        } catch (error) {
          logger.error(`Failed to dispatch replies: ${error}`);
          return c.json({ delivered: [] } satisfies CallbackResponse, 500);
        } finally {
          callbackManager.complete(requestId);
        }
      }
    }
  });

  const server = serve({ fetch: app.fetch, port: CALLBACK_PORT }, () => {
    logger.info(`Callback server listening on port ${CALLBACK_PORT}`);
  });

  const processQueue = async (channel: PlatformChannel) => {
    while (messageQueue.length > 0) {
      const batch = messageQueue.splice(0);
      logger.info(`Processing batch of ${batch.length} message(s): [${batch.map((m) => m.messageId).join(', ')}]`);
      for (const m of batch) {
        channel.trackMessage(m);
      }

      try {
        const { callbackUrl, completed } = callbackManager.createCallback(channel, batch);
        logger.info(`Created callback: ${callbackUrl}`);
        await brain.respondAsync({ messages: batch, systemPrompt, allowedTools: ['WebSearch', 'WebFetch'], callbackUrl });
        // Keep brain alive while waiting — periodic health pings prevent idle timeout
        const healthKeepAlive = setInterval(() => {
          brain.health().catch((err) => logger.warn(`Health keepalive failed: ${err}`));
        }, 60_000);
        try {
          // Brain accepted (202) — wait for the message callback before processing next batch
          await completed;
        } finally {
          clearInterval(healthKeepAlive);
        }
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
      logger.info(`Queued message ${message.messageId} from ${message.authorDisplayName} (${message.authorId}), queue size: ${messageQueue.length}, processing: ${!!processing}, channel: ${!!platformChannel}`);
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
    callbackManager.stopCleanup();
    server.close();
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
