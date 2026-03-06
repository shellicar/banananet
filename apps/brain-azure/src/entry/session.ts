import { app } from '@azure/functions';

app.http('session-get', {
  methods: ['GET'],
  authLevel: 'function',
  route: 'session',
  handler: async (request, context) => {
    const { handler } = await import('./handlers/session-set');
    return await handler(request, context);
  },
});

app.http('session-set', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'session',
  handler: async (request, context) => {
    const { handler } = await import('./handlers/session-set');
    return await handler(request, context);
  },
});
