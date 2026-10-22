import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const server = createApp().listen(port, '127.0.0.1', () => {
  console.log(`QueueSmart API running at http://127.0.0.1:${port}/api`);
});

server.on('error', (error) => {
  console.error('QueueSmart API could not start:', error.message);
  process.exitCode = 1;
});
