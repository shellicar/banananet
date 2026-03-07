import { Instant } from '@js-joda/core';
import { logger } from '@simple-claude-bot/shared/logger';
import { BotCapability } from '@simple-claude-bot/shared/shared/platform/schema';
import type { Reply } from '@simple-claude-bot/shared/shared/types';
import { timestampFormatter } from '@simple-claude-bot/shared/timestampFormatter';
import { zone } from '@simple-claude-bot/shared/zone';

const TICK_INTERVAL_MS = 5 * 60 * 1000;
const MAX_PROBABILITY = 0.5;
const PROBABILITY_DIVISOR = 1200;
const QUIET_HOUR_START = 22;
const QUIET_HOUR_END = 10;

interface WorkPlayConfig {
  workspaceEnabled: boolean;
  onIdle: (prompt: string, options: { capabilities?: Partial<Record<BotCapability, boolean>> }) => Promise<{ replies: Reply[]; spoke: boolean }>;
  isProcessing: () => boolean;
  setProcessing: (p: Promise<void>) => void;
  setPresence?: (status: 'online' | 'idle') => void;
}

let lastActivityUtc = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
let activeConfig: WorkPlayConfig | undefined;

export function resetActivity(): void {
  lastActivityUtc = Date.now();
}

export function seedActivity(timestamp: number): void {
  lastActivityUtc = timestamp;
}

function idleProbability(elapsedMs: number): number {
  const minutes = elapsedMs / 60_000;
  return Math.min(MAX_PROBABILITY, minutes / PROBABILITY_DIVISOR);
}

function isQuietHours(): boolean {
  const hour = Instant.now().atZone(zone).hour();
  return hour >= QUIET_HOUR_START || hour < QUIET_HOUR_END;
}

function buildIdlePrompt(): string {
  const now = Instant.now().atZone(zone).format(timestampFormatter);
  return `[System: The current time is ${now}. The channel has been quiet for a while. You can say something to the channel, do some work in the sandbox, or do nothing — it's up to you. Always explain your thinking first — what you considered, why you decided to speak or stay quiet, and what caught your attention (or didn't). Then provide your reply blocks. If you have nothing to say or do, still explain your reasoning before responding with an empty block. Don't force conversation.]`;
}

async function onTick(config: WorkPlayConfig): Promise<void> {
  if (config.isProcessing()) {
    logger.debug('WorkPlay tick: skipped (processing)');
    return;
  }

  if (isQuietHours()) {
    config.setPresence?.('idle');
    logger.debug('WorkPlay tick: skipped (quiet hours)');
    return;
  }
  config.setPresence?.('online');

  const elapsedMs = Date.now() - lastActivityUtc;
  const probability = idleProbability(elapsedMs);
  const roll = Math.random();

  logger.debug(`WorkPlay tick: elapsed=${Math.round(elapsedMs / 60_000)}min probability=${(probability * 100).toFixed(1)}% roll=${(roll * 100).toFixed(1)}%`);

  if (roll >= probability) {
    return;
  }

  logger.info('WorkPlay: triggered idle action');
  sendIdlePrompt(config);
}

function sendIdlePrompt(config: WorkPlayConfig): void {
  const prompt = buildIdlePrompt();
  const capabilities = config.workspaceEnabled ? undefined : { [BotCapability.Web]: false, [BotCapability.Workspace]: false };

  const task = config.onIdle(prompt, { capabilities }).then(({ spoke }) => {
    logger.info(`WorkPlay: idle action complete (spoke=${spoke})`);
  });

  config.setProcessing(task);
  resetActivity();
}

export function triggerWorkPlay(): boolean {
  if (!activeConfig) {
    logger.warn('WorkPlay: not started');
    return false;
  }
  if (activeConfig.isProcessing()) {
    logger.warn('WorkPlay: already processing');
    return false;
  }
  logger.info('WorkPlay: manual trigger');
  sendIdlePrompt(activeConfig);
  return true;
}

export function startWorkPlay(config: WorkPlayConfig): void {
  logger.info('WorkPlay: starting idle timer');
  activeConfig = config;
  resetActivity();
  onTick(config).catch((error) => {
    logger.error(`WorkPlay tick error: ${error}`, error instanceof Error ? { cause: error.cause } : undefined);
  });
  timer = setInterval(() => {
    onTick(config).catch((error) => {
      logger.error(`WorkPlay tick error: ${error}`, error instanceof Error ? { cause: error.cause } : undefined);
    });
  }, TICK_INTERVAL_MS);
}

export function stopWorkPlay(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
    activeConfig = undefined;
    logger.info('WorkPlay: stopped idle timer');
  }
}
