import { Client, GatewayIntentBits, Partials } from 'discord.js';

export const createDiscordClient = () => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Message, Partials.Channel],
  });
  return client;
};
