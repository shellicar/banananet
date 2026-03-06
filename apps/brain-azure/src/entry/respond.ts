import { app } from '@azure/functions';

app.http('respond', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'respond',
  handler: async (request, context) => {
    const { handler } = await import('./handlers/respond');
    return await handler(request, context);
  },
});
