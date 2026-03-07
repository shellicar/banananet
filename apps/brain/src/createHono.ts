import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import type { AuditWriter } from '@simple-claude-bot/brain-core/audit/auditLog';
import { compactSession } from '@simple-claude-bot/brain-core/compactSession';
import { directQuery } from '@simple-claude-bot/brain-core/directQuery';
import { ApiError } from '@simple-claude-bot/brain-core/errors/ApiError';
import { SdkError } from '@simple-claude-bot/brain-core/errors/SdkError';
import { getSessionId } from '@simple-claude-bot/brain-core/getSessionId';
import { pingSDK } from '@simple-claude-bot/brain-core/ping/pingSDK';
import { processAndCallback } from '@simple-claude-bot/brain-core/processAndCallback';
import { resetSession } from '@simple-claude-bot/brain-core/session/resetSession';
import { setSessionId } from '@simple-claude-bot/brain-core/session/setSessionId';
import type { SdkConfig } from '@simple-claude-bot/brain-core/types';
import { sendUnprompted } from '@simple-claude-bot/brain-core/unsolicited/sendUnprompted';
import { logger } from '@simple-claude-bot/shared/logger';
import { CompactRequestSchema, DirectRequestSchema, ResetRequestSchema, RespondRequestSchema, SessionSetRequestSchema, UnpromptedRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { CompactResponse, DirectResponse, HealthResponse, PingResponse, ResetResponse, SessionResponse, UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';
import { type Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

function handleError(c: Context, route: string, error: unknown, errorBody: Record<string, unknown>) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'Error';

  const errorCause = error instanceof Error && error.cause ? String(error.cause) : undefined;
  logger.error(`${route} error: ${errorName}: ${errorMessage}`, ...(errorCause ? [{ cause: errorCause }] : []));

  let statusCode: ContentfulStatusCode = 500;
  if (error instanceof ZodError) {
    statusCode = 400;
  } else if (error instanceof SdkError) {
    statusCode = error.httpCode as ContentfulStatusCode;
  }

  const jsonBody: Record<string, unknown> = { ...errorBody, error: errorMessage };
  if (error instanceof ApiError) {
    jsonBody.upstreamStatus = error.apiStatusCode;
    jsonBody.upstreamErrorType = error.errorType;
  }
  if (errorCause) {
    jsonBody.cause = errorCause;
  }

  logger.info('Http Response', { status: statusCode, error: errorName });
  return c.json(jsonBody, statusCode);
}

interface BrainHonoOptions {
  audit: AuditWriter;
  sdkConfig: SdkConfig;
  callbackHeaders: Record<string, string>;
  abortController: AbortController;
  signal: AbortSignal;
  port: number;
}

export function createHono({ audit, sdkConfig, callbackHeaders, abortController, signal, port }: BrainHonoOptions) {
  const app = new Hono();

  app.get('/', (c) => c.body(null, 204));

  const api = app.basePath('/api');

  api.get('/health', (c) => {
    return c.json({ status: 'ok' } satisfies HealthResponse);
  });

  api.get('/session', (c) => {
    const sessionId = getSessionId() ?? null;
    return c.json({ sessionId } satisfies SessionResponse);
  });

  api.post('/session', async (c) => {
    try {
      const { sessionId } = SessionSetRequestSchema.parse(await c.req.json(), { reportInput: true });
      setSessionId(sessionId);
      return c.json({ sessionId } satisfies SessionResponse);
    } catch (error) {
      return handleError(c, '/session', error, { sessionId: null });
    }
  });

  api.post('/ping', async (c) => {
    try {
      logger.info('/ping: received request');
      const result = await pingSDK(audit, sdkConfig, abortController);
      logger.info('/ping: complete');
      return c.json({ result } satisfies PingResponse);
    } catch (error) {
      return handleError(c, '/ping', error, { result: '' });
    }
  });

  api.post('/respond', async (c) => {
    try {
      logger.info('/respond: received request');
      const body = RespondRequestSchema.parse(await c.req.json(), { reportInput: true });
      logger.info(`/respond: parsed ${body.messages.length} messages, callback=${body.callbackUrl}`);

      processAndCallback(body, audit, sdkConfig, callbackHeaders, abortController).catch((error) => logger.error(`/respond: unhandled error in background processing: ${error}`));

      return c.body(null, 202);
    } catch (error) {
      return handleError(c, '/respond', error, { replies: [] });
    }
  });

  api.post('/unprompted', async (c) => {
    try {
      logger.info('/unprompted: received request');
      const body = UnpromptedRequestSchema.parse(await c.req.json(), { reportInput: true });
      logger.info(`/unprompted: trigger=${body.trigger}`);
      const { replies, spoke } = await sendUnprompted(audit, body, sdkConfig, abortController);
      logger.info(`/unprompted: complete, spoke=${spoke}, replies=${replies.length}`);
      return c.json({ replies, spoke } satisfies UnpromptedResponse);
    } catch (error) {
      return handleError(c, '/unprompted', error, { replies: [], spoke: false });
    }
  });

  api.post('/direct', async (c) => {
    try {
      logger.info('/direct: received request');
      const body = DirectRequestSchema.parse(await c.req.json(), { reportInput: true });
      const result = await directQuery(audit, body, sdkConfig, abortController);
      logger.info('/direct: complete');
      return c.json({ result } satisfies DirectResponse);
    } catch (error) {
      return handleError(c, '/direct', error, { result: '' });
    }
  });

  api.post('/compact', async (c) => {
    try {
      logger.info('/compact: received request');
      const body = CompactRequestSchema.parse(await c.req.json(), { reportInput: true });
      const result = await compactSession(audit, sdkConfig, body.resumeSessionAt, abortController);
      logger.info('/compact: complete');
      return c.json({ result } satisfies CompactResponse);
    } catch (error) {
      return handleError(c, '/compact', error, { result: '' });
    }
  });

  api.post('/reset', async (c) => {
    try {
      logger.info('/reset: received request');
      const body = ResetRequestSchema.parse(await c.req.json(), { reportInput: true });
      logger.info(`/reset: ${body.messages.length} messages`);
      const result = await resetSession(audit, body, sdkConfig, abortController);
      logger.info('/reset: complete');
      return c.json({ result } satisfies ResetResponse);
    } catch (error) {
      return handleError(c, '/reset', error, { result: '' });
    }
  });

  const server = serve({ fetch: app.fetch, port }, () => {
    logger.info('Brain listening on port', { component: 'lifecycle', port });
  }) as Server;
  server.requestTimeout = 10 * 60 * 1000;
  server.headersTimeout = 10 * 60 * 1000 + 1000;

  signal.addEventListener('abort', () => {
    logger.info('Closing HTTP server', { component: 'lifecycle' });
    server.close(() => {
      logger.info('HTTP server closed', { component: 'lifecycle' });
    });
  });
}
