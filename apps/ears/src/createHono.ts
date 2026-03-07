import { serve } from '@hono/node-server';
import type { EarsApp } from '@simple-claude-bot/ears-core/earsApp';
import { logger } from '@simple-claude-bot/shared/logger';
import { Version } from '@simple-claude-bot/shared/version';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function createHono(earsApp: EarsApp, port: number, signal: AbortSignal) {
  const app = new Hono();

  app.get('/', (c) => c.body(null, 204));

  const api = app.basePath('/api');

  api.get('/health', (c) => c.json({ status: 'ok' }));

  api.get('/version', (c) => c.json(Version));

  api.post('/callback/:requestId', async (c) => {
    const result = await earsApp.handleCallback(c.req.param('requestId'), await c.req.json());
    return c.json(result.body, result.status as ContentfulStatusCode);
  });

  const server = serve({ fetch: app.fetch, port }, () => {
    logger.info(`Callback server listening on port ${port}`);
  });

  signal.addEventListener('abort', () => {
    server.close();
  });
}
