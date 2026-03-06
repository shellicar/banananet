import { app } from '@azure/functions';

app.http('unprompted', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'unprompted',
  handler: async (request, context) => {
    const { handler } = await import('./handlers/unprompted');
    return await handler(request, context);
  },
});
