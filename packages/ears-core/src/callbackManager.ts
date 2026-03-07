import { randomUUID } from 'node:crypto';
import { logger } from '@simple-claude-bot/shared/logger';
import type { PlatformChannel } from './platform/types';
import type { PlatformMessageInput } from './types';

export interface PendingRequest {
  channel: PlatformChannel;
  messages: PlatformMessageInput[];
  startedAt: number;
  /** Resolved when the message callback arrives — lets processQueue stay serial */
  resolve: () => void;
}

export class CallbackManager {
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;
  private readonly maxWaitMs = 10 * 60 * 1000; // 10 minutes safety net

  public constructor(private readonly host: string) {}

  /**
   * Register a pending request and return the callback URL + a promise
   * that resolves when the message callback arrives (for queue serialization).
   */
  public createCallback(channel: PlatformChannel, messages: PlatformMessageInput[]): { callbackUrl: string; completed: Promise<void> } {
    const requestId = randomUUID();
    let resolve!: () => void;
    const completed = new Promise<void>((r) => {
      resolve = r;
    });

    this.pendingRequests.set(requestId, {
      channel,
      messages,
      startedAt: Date.now(),
      resolve,
    });

    return {
      callbackUrl: `${this.host}/callback/${requestId}`,
      completed,
    };
  }

  public get(requestId: string): PendingRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  public complete(requestId: string): void {
    const context = this.pendingRequests.get(requestId);
    if (context) {
      this.pendingRequests.delete(requestId);
      context.channel.clearTracked();
      context.resolve();
    }
  }

  public startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, ctx] of this.pendingRequests) {
        if (now - ctx.startedAt > this.maxWaitMs) {
          logger.warn(`Callback request ${id} timed out after ${Math.round((now - ctx.startedAt) / 1000)}s, cleaning up`);
          this.pendingRequests.delete(id);
          ctx.resolve(); // Unblock the queue even on timeout
        }
      }
    }, 60_000);
  }

  public stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
