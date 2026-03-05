import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { logger } from '@simple-claude-bot/shared/logger';
import type { CallbackDeliveredMessage, CallbackMessageResponse, CallbackPayload, ParsedReply } from '@simple-claude-bot/shared/shared/types';
import { Hono } from 'hono';
import type { PlatformChannel } from './platform/types';
import type { PlatformMessageInput } from './types';

export interface PendingRequest {
  channel: PlatformChannel;
  messages: PlatformMessageInput[];
  startedAt: number;
  /** Resolved when the message callback arrives — lets processQueue stay serial */
  resolve: () => void;
}

export interface CallbackServerOptions {
  port: number;
  host?: string;
  dispatchReplies: (channel: PlatformChannel, replies: ParsedReply[], messages?: PlatformMessageInput[]) => Promise<void>;
}

export class CallbackServer {
  private server: Server | undefined;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;
  private readonly maxWaitMs = 10 * 60 * 1000; // 10 minutes safety net

  public constructor(private readonly options: CallbackServerOptions) {}

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

    const host = this.options.host ?? `localhost:${this.options.port}`;
    return {
      callbackUrl: `http://${host}/callback/${requestId}`,
      completed,
    };
  }

  public start(): void {
    const app = new Hono();

    app.post('/callback/:requestId', async (c) => {
      const requestId = c.req.param('requestId');
      const context = this.pendingRequests.get(requestId);
      if (!context) {
        logger.warn(`Callback for unknown request ${requestId}`);
        return c.body(null, 404);
      }

      const payload = (await c.req.json()) as CallbackPayload;

      switch (payload.type) {
        case 'typing': {
          await context.channel.sendTyping();
          return c.json({});
        }

        case 'message': {
          // Deliver replies to Discord
          await this.options.dispatchReplies(context.channel, payload.replies, context.messages);

          // Clean up and signal completion
          this.pendingRequests.delete(requestId);
          context.channel.clearTracked();
          context.resolve();

          // Respond with delivered message IDs
          const delivered: CallbackDeliveredMessage[] = payload.replies.map((_, index) => ({
            index,
            messageId: '', // TODO: capture actual Discord message IDs from dispatchReplies
          }));
          return c.json({ delivered } satisfies CallbackMessageResponse);
        }

        default: {
          logger.warn(`Unknown callback type: ${(payload as { type: string }).type}`);
          return c.body(null, 400);
        }
      }
    });

    this.server = serve({ fetch: app.fetch, port: this.options.port }, () => {
      logger.info(`Callback server listening on port ${this.options.port}`);
    }) as Server;

    // Safety net: clean up stale pending requests
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

  public stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.server?.close();
  }
}
