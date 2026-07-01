import { createServer } from './server';

const port = Number(process.env.PORT ?? 8080);
const server = createServer();

server.listen(port, () => {
  // Structured log line so it is easy to parse in aggregation pipelines.
  console.log(JSON.stringify({ level: 'info', msg: 'listening', port }));
});

// Close the server cleanly when the platform sends a termination signal.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
