import { env } from 'node:process';
import { earsSchema } from '@simple-claude-bot/ears-core/earsSchema';
import { logger } from '@simple-claude-bot/shared/logger';
import { PermissionFlagsBits, REST, Routes } from 'discord.js';
import { type APIApplication, ApplicationFlags } from 'discord-api-types/v10';

const REQUIRED_PERMISSIONS = [
  { name: 'ViewChannel', bit: PermissionFlagsBits.ViewChannel },
  { name: 'SendMessages', bit: PermissionFlagsBits.SendMessages },
  { name: 'ReadMessageHistory', bit: PermissionFlagsBits.ReadMessageHistory },
] as const;

const REQUIRED_PERMISSION_BITS = REQUIRED_PERMISSIONS.reduce((acc, p) => acc | p.bit, 0n);

const setup = async () => {
  const { DISCORD_TOKEN, CLAUDE_CHANNEL } = earsSchema.parse(env);

  logger.info('Discord Bot Setup Verification');
  logger.info('='.repeat(50));

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  // 1. Fetch application info
  logger.info('Fetching application info...');
  const app = (await rest.get(Routes.currentApplication())) as APIApplication;
  logger.info(`App: ${app.name} (${app.id})`);
  if (app.description) {
    logger.info(`Description: ${app.description}`);
  }
  logger.info(`Flags: ${app.flags ?? 0}`);

  // 2. Check message content intent flags
  const flags = app.flags ?? 0;
  const hasMessageContent = (flags & ApplicationFlags.GatewayMessageContent) !== 0;
  const hasMessageContentLimited = (flags & ApplicationFlags.GatewayMessageContentLimited) !== 0;

  if (hasMessageContent) {
    logger.info('PASS: Message Content intent (verified, 100+ servers)');
  } else if (hasMessageContentLimited) {
    logger.info('PASS: Message Content intent (limited, <100 servers)');
  } else {
    logger.error('FAIL: Message Content intent not enabled — enable in Developer Portal > Bot > Privileged Gateway Intents');
  }

  // 3. Generate invite URL
  logger.info('-'.repeat(50));
  logger.info(`Target channel: #${CLAUDE_CHANNEL}`);
  logger.info(`Required permissions: ${REQUIRED_PERMISSIONS.map((p) => p.name).join(', ')} (${REQUIRED_PERMISSION_BITS})`);
  logger.info('Invite URL:');
  logger.info(`https://discord.com/oauth2/authorize?client_id=${app.id}&permissions=${REQUIRED_PERMISSION_BITS}&integration_type=0&scope=bot`);

  // 4. Summary
  logger.info('='.repeat(50));
  logger.info('Setup verification complete');
};

await setup();
