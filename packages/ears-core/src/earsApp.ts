import { logger } from '@simple-claude-bot/shared/logger';
import { BotCapability } from '@simple-claude-bot/shared/shared/platform/schema';
import type { z } from 'zod';
import { BrainClient } from './brainClient';
import { CallbackManager, type CallbackResult } from './callbackManager';
import type { CommandContext } from './commands';
import { dispatchReplies } from './dispatchReplies';
import type { earsSchema } from './earsSchema';
import { startDiscord } from './platform/discord/startDiscord';
import type { PlatformChannel } from './platform/types';
import { buildSystemPrompt } from './systemPrompts';
import type { PlatformMessageInput } from './types';
import { resetActivity, seedActivity, startWorkPlay, stopWorkPlay, triggerWorkPlay } from './workplay';

export type EarsConfig = z.infer<typeof earsSchema>;

export interface EarsApp {
  handleCallback(requestId: string, body: unknown): Promise<CallbackResult>;
  commandContext: CommandContext;
}

export function createEarsApp(config: EarsConfig, signal: AbortSignal): EarsApp {
  const brain = new BrainClient(config.BRAIN_URL, config.BRAIN_KEY);
  const callbackManager = new CallbackManager(config.CALLBACK_HOST);
  callbackManager.startCleanup();

  let processing: Promise<void> | undefined;
  const messageQueue: PlatformMessageInput[] = [];
  let platformChannel: PlatformChannel | undefined;
  let systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: config.WORKSPACE_ENABLED, sandboxCommands: config.SANDBOX_COMMANDS, botAliases: config.BOT_ALIASES });

  const processQueue = async (channel: PlatformChannel) => {
    while (messageQueue.length > 0) {
      const batch = messageQueue.splice(0);
      logger.info(`Processing batch of ${batch.length} message(s): [${batch.map((m) => m.messageId).join(', ')}]`);
      for (const m of batch) {
        channel.trackMessage(m);
      }

      const { callbackUrl, requestId, completed } = callbackManager.createCallback(channel, batch);
      logger.info(`Created callback: ${callbackUrl}`);
      try {
        await brain.respondAsync({ messages: batch, systemPrompt, capabilities: { [BotCapability.Workspace]: config.WORKSPACE_ENABLED }, callbackUrl });
        const healthKeepAlive = setInterval(() => {
          brain.health().catch((err) => logger.warn(`Health keepalive failed: ${err}`));
        }, 60_000);
        try {
          await completed;
        } finally {
          clearInterval(healthKeepAlive);
        }
      } catch (error) {
        logger.error(`Error sending to brain: ${error}`, error instanceof Error ? { cause: error.cause } : undefined);
        callbackManager.complete(requestId);
      }
    }
  };

  const handle = startDiscord({ guildId: config.DISCORD_GUILD, channelName: config.CLAUDE_CHANNEL }, config.DISCORD_TOKEN, {
    onReady: (info) => {
      systemPrompt = buildSystemPrompt({ type: 'discord', sandbox: config.WORKSPACE_ENABLED, sandboxCommands: config.SANDBOX_COMMANDS, botUserId: info.botUserId, botUsername: info.botUsername, botAliases: config.BOT_ALIASES });
      logger.debug(`System prompt: ${systemPrompt}`);
      platformChannel = info.channel;
      if (info.lastMessageTimestamp) {
        seedActivity(info.lastMessageTimestamp);
      }
      startWorkPlay({
        workspaceEnabled: config.WORKSPACE_ENABLED,
        onIdle: async (prompt, options) => {
          const response = await brain.unprompted({ prompt, systemPrompt, capabilities: options.capabilities });
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

  signal.addEventListener('abort', () => {
    stopWorkPlay();
    callbackManager.stopCleanup();
    handle.destroy();
  });

  const commandContext = {
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

  return {
    handleCallback: (requestId, body) => callbackManager.handleCallback(requestId, body, dispatchReplies),
    commandContext,
  };
}
