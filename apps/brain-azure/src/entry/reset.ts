import { app } from '@azure/functions';

app.http('reset', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'reset',
  handler: async (request, context) => {
    const { handler } = await import('./handlers/reset');
    return await handler(request, context);
  },
});
