import { logger } from '@simple-claude-bot/shared/logger';
import { CompactResponseSchema, DirectResponseSchema, HealthResponseSchema, PingResponseSchema, ResetResponseSchema, RespondResponseSchema, SessionResponseSchema, UnpromptedResponseSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { CompactResponse, DirectResponse, HealthResponse, PingResponse, ResetResponse, RespondResponse, SessionResponse, UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';
import type { z } from 'zod';
import type { CompactRequestInput, DirectRequestInput, ResetRequestInput, RespondRequestInput, SessionSetRequestInput, UnpromptedRequestInput } from './types';

const TIMEOUT_MS = 10 * 60 * 1000;

export class BrainClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly functionKey?: string,
  ) {}

  public async health(): Promise<HealthResponse> {
    return this.get('/health', HealthResponseSchema);
  }

  public async ping(): Promise<PingResponse> {
    return this.post('/ping', {}, PingResponseSchema);
  }

  public async respond(request: RespondRequestInput): Promise<RespondResponse> {
    return this.post('/respond', request, RespondResponseSchema);
  }

  /**
   * Send a respond request with a callback URL. Brain returns 202 immediately.
   * Results will arrive via HTTP callbacks to the provided URL.
   */
  public async respondAsync(request: RespondRequestInput & { callbackUrl: string }): Promise<void> {
    const url = `${this.baseUrl}/respond`;
    const startTime = Date.now();
    logger.info(`Brain POST ${url} (async, callback: ${request.callbackUrl})`);
    logger.debug(`Brain POST /respond request: ${JSON.stringify(request)}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const duration = Date.now() - startTime;
    if (response.status !== 202) {
      const body = await response.text().catch(() => '');
      logger.error(`Brain POST /respond (async) → ${response.status} (${duration}ms): ${body}`);
      throw new Error(`Brain /respond async failed: ${response.status} ${response.statusText}: ${body}`);
    }
    logger.info(`Brain POST /respond (async) → ${response.status} (${duration}ms)`);
  }

  public async unprompted(request: UnpromptedRequestInput): Promise<UnpromptedResponse> {
    return this.post('/unprompted', request, UnpromptedResponseSchema);
  }

  public async direct(request: DirectRequestInput): Promise<DirectResponse> {
    return this.post('/direct', request, DirectResponseSchema);
  }

  public async compact(request: CompactRequestInput = {}): Promise<CompactResponse> {
    return this.post('/compact', request, CompactResponseSchema);
  }

  public async reset(request: ResetRequestInput): Promise<ResetResponse> {
    return this.post('/reset', request, ResetResponseSchema);
  }

  public async getSession(): Promise<SessionResponse> {
    return this.get('/session', SessionResponseSchema);
  }

  public async setSession(sessionId: string): Promise<SessionResponse> {
    return this.post('/session', { sessionId } satisfies SessionSetRequestInput, SessionResponseSchema);
  }

  private async withWaitingLog<T>(path: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.debug(`Brain ${path}: still waiting after ${elapsed}s...`);
    }, 5000);
    try {
      return await fn();
    } finally {
      clearInterval(timer);
    }
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.functionKey) {
      headers['x-functions-key'] = this.functionKey;
    }
    if (extra) {
      Object.assign(headers, extra);
    }
    return headers;
  }

  private async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();
    logger.info(`Brain GET ${url}`);
    return this.withWaitingLog(path, async () => {
      const response = await fetch(url, { headers: this.buildHeaders(), signal: AbortSignal.timeout(TIMEOUT_MS) });
      const duration = Date.now() - startTime;
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.error(`Brain GET ${path} → ${response.status} (${duration}ms): ${body}`);
        throw new Error(`Brain ${path} failed: ${response.status} ${response.statusText}: ${body}`);
      }
      const json = await response.json();
      logger.info(`Brain GET ${path} → ${response.status} (${duration}ms)`);
      logger.debug(`Brain GET ${path} response: ${JSON.stringify(json)}`);
      return schema.parse(json, { reportInput: true });
    });
  }

  private async post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();
    logger.info(`Brain POST ${url}`);
    logger.debug(`Brain POST ${url} request: ${JSON.stringify(body)}`);
    return this.withWaitingLog(path, async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const duration = Date.now() - startTime;
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.error(`Brain POST ${path} → ${response.status} (${duration}ms): ${body}`);
        throw new Error(`Brain ${path} failed: ${response.status} ${response.statusText}: ${body}`);
      }
      const json = await response.json();
      logger.info(`Brain POST ${path} → ${response.status} (${duration}ms)`);
      logger.debug(`Brain POST ${path} response: ${JSON.stringify(json)}`);
      return schema.parse(json, { reportInput: true });
    });
  }
}
