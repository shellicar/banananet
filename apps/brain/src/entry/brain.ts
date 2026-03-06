import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import { env } from 'node:process';
import { serve } from '@hono/node-server';
import versionInfo from '@shellicar/build-version/version';
import { AuditWriter } from '@simple-claude-bot/brain-core/audit/auditLog';
import { brainSchema } from '@simple-claude-bot/brain-core/brainSchema';
import { compactSession } from '@simple-claude-bot/brain-core/compactSession';
import { directQuery } from '@simple-claude-bot/brain-core/directQuery';
import { ApiError } from '@simple-claude-bot/brain-core/errors/ApiError';
import { SdkError } from '@simple-claude-bot/brain-core/errors/SdkError';
import { getSessionId } from '@simple-claude-bot/brain-core/getSessionId';
import { initSessionPaths } from '@simple-claude-bot/brain-core/initSessionPaths';
import { pingSDK } from '@simple-claude-bot/brain-core/ping/pingSDK';
import { processAndCallback } from '@simple-claude-bot/brain-core/processAndCallback';
import { resetSession } from '@simple-claude-bot/brain-core/session/resetSession';
import { setSessionId } from '@simple-claude-bot/brain-core/session/setSessionId';
import type { SandboxConfig } from '@simple-claude-bot/brain-core/types';
import { sendUnprompted } from '@simple-claude-bot/brain-core/unsolicited/sendUnprompted';
import { logger } from '@simple-claude-bot/shared/logger';
import { CompactRequestSchema, DirectRequestSchema, ResetRequestSchema, RespondRequestSchema, SessionSetRequestSchema, UnpromptedRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { CompactResponse, DirectResponse, HealthResponse, PingResponse, ResetResponse, SessionResponse, UnpromptedResponse } from '@simple-claude-bot/shared/shared/types';
import { type Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

const main = async () => {
  const dockerBuildTime = process.env.BANANABOT_BUILD_TIME;
  const dockerBuildHash = process.env.BANANABOT_BUILD_HASH;
  logger.info(`Starting brain v${versionInfo.version} (${versionInfo.shortSha}) built ${versionInfo.buildDate} | docker: ${dockerBuildHash} built ${dockerBuildTime}`);

  const { CLAUDE_CONFIG_DIR, SANDBOX_ENABLED, SANDBOX_DIR, AUDIT_DIR } = brainSchema.parse(env);

  initSessionPaths(CLAUDE_CONFIG_DIR);
  const audit = new AuditWriter(AUDIT_DIR);

  const sandboxConfig = {
    enabled: SANDBOX_ENABLED,
    directory: resolve(SANDBOX_DIR),
  } satisfies SandboxConfig;

  mkdirSync(sandboxConfig.directory, { recursive: true });
  logger.info(`Sandbox ${sandboxConfig.enabled ? 'enabled' : 'disabled'} (cwd: ${sandboxConfig.directory})`);

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

  const app = new Hono();

  app.get('/health', (c) => {
    return c.json({ status: 'ok' } satisfies HealthResponse);
  });

  app.get('/session', (c) => {
    const sessionId = getSessionId() ?? null;
    return c.json({ sessionId } satisfies SessionResponse);
  });

  app.post('/session', async (c) => {
    try {
      const { sessionId } = SessionSetRequestSchema.parse(await c.req.json());
      setSessionId(sessionId);
      return c.json({ sessionId } satisfies SessionResponse);
    } catch (error) {
      return handleError(c, '/session', error, { sessionId: null });
    }
  });

  app.post('/ping', async (c) => {
    try {
      const result = await pingSDK(audit, sandboxConfig);
      return c.json({ result } satisfies PingResponse);
    } catch (error) {
      return handleError(c, '/ping', error, { result: '' });
    }
  });

  app.post('/respond', async (c) => {
    try {
      const body = RespondRequestSchema.parse(await c.req.json());

      processAndCallback(body, audit, sandboxConfig).catch((error) => {
        logger.error(`Unhandled error in background processing: ${error}`);
      });

      return c.body(null, 202);
    } catch (error) {
      return handleError(c, '/respond', error, { replies: [] });
    }
  });

  app.post('/unprompted', async (c) => {
    try {
      const body = UnpromptedRequestSchema.parse(await c.req.json());
      const { replies, spoke } = await sendUnprompted(audit, body, sandboxConfig);
      return c.json({ replies, spoke } satisfies UnpromptedResponse);
    } catch (error) {
      return handleError(c, '/unprompted', error, { replies: [], spoke: false });
    }
  });

  app.post('/direct', async (c) => {
    try {
      const body = DirectRequestSchema.parse(await c.req.json());
      const result = await directQuery(audit, body, sandboxConfig);
      return c.json({ result } satisfies DirectResponse);
    } catch (error) {
      return handleError(c, '/direct', error, { result: '' });
    }
  });

  app.post('/compact', async (c) => {
    try {
      const body = CompactRequestSchema.parse(await c.req.json());
      const result = await compactSession(audit, sandboxConfig, body.resumeSessionAt);
      return c.json({ result } satisfies CompactResponse);
    } catch (error) {
      return handleError(c, '/compact', error, { result: '' });
    }
  });

  app.post('/reset', async (c) => {
    try {
      const body = ResetRequestSchema.parse(await c.req.json());
      const result = await resetSession(audit, body, sandboxConfig);
      return c.json({ result } satisfies ResetResponse);
    } catch (error) {
      return handleError(c, '/reset', error, { result: '' });
    }
  });

  const port = 3000;
  const server = serve({ fetch: app.fetch, port }, () => {
    logger.info(`Brain listening on port ${port}`);
  }) as Server;
  server.requestTimeout = 10 * 60 * 1000;
  server.headersTimeout = 10 * 60 * 1000 + 1000;
};

await main();
