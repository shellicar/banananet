import { app } from '@azure/functions';

app.http('compact', {
  methods: ['POST'],
  authLevel: 'function',
  route: 'compact',
  handler: async (request, context) => {
    const { handler } = await import('./handlers/compact');
    return await handler(request, context);
  },
});
