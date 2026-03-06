import { app } from '@azure/functions';

app.http('ping', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'ping',
  handler: async (request, context) => {
    const { handler } = await import('./handlers/ping');
    return await handler(request, context);
  },
});
