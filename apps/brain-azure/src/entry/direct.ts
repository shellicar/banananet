import { app } from '@azure/functions';

app.http('direct', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'direct',
  handler: async (request, context) => {
    const { handler } = await import('./handlers/direct');
    return await handler(request, context);
  },
});
