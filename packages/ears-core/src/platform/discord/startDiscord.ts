import { logger } from '@simple-claude-bot/shared/logger';
import { type Message, type PresenceStatus, type PresenceStatusData, TextChannel } from 'discord.js';
import { createDiscordClient } from '../../createDiscordClient';
import type { PlatformMessageInput } from '../../types';
import type { PlatformChannel } from '../types';
import { DiscordChannel } from './DiscordChannel.js';
import { DiscordMessage } from './DiscordMessage.js';

interface DiscordConfig {
  readonly guildId: string;
  readonly channelName: string;
}

interface DiscordReadyInfo {
  readonly channel: PlatformChannel;
  readonly botUserId?: string;
  readonly botUsername?: string;
  readonly lastMessageTimestamp?: number;
}

interface DiscordHandle {
  destroy(): void;
  setPresence(status: PresenceStatusData): void;
}

export function startDiscord(
  config: DiscordConfig,
  token: string,
  callbacks: {
    onReady: (info: DiscordReadyInfo) => void;
    onMessage: (message: PlatformMessageInput) => void;
  },
): DiscordHandle {
  const client = createDiscordClient();

  client.once('ready', async () => {
    const botUserId = client.user?.id;
    const botUsername = client.user?.username;
    logger.info(`Logged in as ${client.user?.tag} (${botUserId})`);
    logger.info(`Listening for messages in #${config.channelName}`);

    const botChannel = client.channels.cache.find((ch): ch is TextChannel => ch instanceof TextChannel && ch.guild.id === config.guildId && ch.name === config.channelName);

    if (!botChannel) {
      logger.warn(`Channel #${config.channelName} not found in guild ${config.guildId}`);
      return;
    }

    const channel = new DiscordChannel(botChannel);
    logger.info(`Found channel #${botChannel.name} in guild ${botChannel.guild.name} (${botChannel.guild.id})`);

    let lastMessageTimestamp: number | undefined;
    const lastMessage = (await botChannel.messages.fetch({ limit: 1 })).first();
    if (lastMessage) {
      lastMessageTimestamp = lastMessage.createdTimestamp;
      logger.info(`Seeded activity from last message at ${new Date(lastMessageTimestamp).toISOString()}`);
    }

    currentPresence = client.user?.presence.status;

    callbacks.onReady({ channel, botUserId, botUsername, lastMessageTimestamp });
  });

  client.on('messageCreate', async (message: Message) => {
    if (message.author.id === client.user?.id) {
      logger.debug(`Filtered own message: author=${message.author.displayName} (${message.author.id})`);
      return;
    }

    const ch = message.channel;
    if (!(ch instanceof TextChannel) || ch.guild.id !== config.guildId || ch.name !== config.channelName) {
      return;
    }

    logger.info(`Message ${message.id} from ${message.author.displayName} (${message.author.id}) in #${ch.name}: ${message.content}`);
    callbacks.onMessage(await DiscordMessage.from(message));
  });

  client.login(token);

  let currentPresence: PresenceStatus | undefined;

  return {
    destroy: () => client.destroy(),
    setPresence: (status: PresenceStatusData) => {
      if (status === currentPresence) {
        return;
      }
      logger.info(`Presence: ${currentPresence ?? 'unknown'} -> ${status}`);
      currentPresence = status;
      client.user?.setPresence({ status });
    },
  };
}
