import { env } from 'node:process';
import { earsSchema } from '@simple-claude-bot/ears-core/earsSchema';
import { logger } from '@simple-claude-bot/shared/logger';
import { ChannelType, PermissionFlagsBits, REST, Routes } from 'discord.js';
import type { APIGuildChannel, RESTAPIPartialCurrentUserGuild } from 'discord-api-types/v10';

const REQUIRED_PERMISSIONS = [
  { name: 'ViewChannel', bit: PermissionFlagsBits.ViewChannel },
  { name: 'SendMessages', bit: PermissionFlagsBits.SendMessages },
  { name: 'ReadMessageHistory', bit: PermissionFlagsBits.ReadMessageHistory },
] as const;

const verify = async () => {
  const { DISCORD_TOKEN, CLAUDE_CHANNEL, DISCORD_GUILD } = earsSchema.parse(env);

  logger.info('Discord Bot Verification');
  logger.info('='.repeat(50));

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  // 1. List guilds
  logger.info('Checking guilds...');
  const guilds = (await rest.get(Routes.userGuilds())) as RESTAPIPartialCurrentUserGuild[];

  logger.info(`Bot is in ${guilds.length} guild(s)`);

  // 2. Check the configured guild
  const targetGuild = guilds.find((g) => g.id === DISCORD_GUILD);
  if (!targetGuild) {
    logger.error(`Bot is not in the configured guild (${DISCORD_GUILD})`);
    return;
  }

  for (const guild of [targetGuild]) {
    logger.info('-'.repeat(50));
    logger.info(`Guild: ${guild.name} (${guild.id})`);

    // Check bot permissions from the guild listing
    const permissions = BigInt(guild.permissions);
    for (const perm of REQUIRED_PERMISSIONS) {
      const has = (permissions & perm.bit) !== 0n;
      if (has) {
        logger.info(`  PASS: ${perm.name}`);
      } else {
        logger.error(`  FAIL: Missing ${perm.name}`);
      }
    }

    // 3. Check for the configured channel
    const channels = (await rest.get(Routes.guildChannels(guild.id))) as APIGuildChannel[];
    const targetChannel = channels.find((ch) => ch.type === ChannelType.GuildText && ch.name === CLAUDE_CHANNEL);

    if (targetChannel) {
      logger.info(`  PASS: Channel #${CLAUDE_CHANNEL} found (${targetChannel.id})`);
    } else {
      logger.error(`  FAIL: Channel #${CLAUDE_CHANNEL} not found`);
    }
  }

  // 4. Summary
  logger.info('='.repeat(50));
  logger.info('Verification complete');
};

await verify();
