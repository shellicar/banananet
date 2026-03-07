import { logger } from '@simple-claude-bot/shared/logger';
import type { CallbackRequest } from '@simple-claude-bot/shared/shared/types';

export async function postCallback(url: string, payload: CallbackRequest, extraHeaders: Record<string, string>): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      logger.warn(`Callback to ${url} failed with status ${response.status}`);
    }
  } catch (error) {
    logger.warn(`Callback to ${url} failed: ${error}`);
  }
}
