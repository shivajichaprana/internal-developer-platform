import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

// The service identifies itself using this name; it defaults to a generic value
// and can be overridden per environment.
const SERVICE_NAME = process.env.SERVICE_NAME ?? 'microservice';

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Route a request. Kept pure and dependency-free so it can be exercised
 * directly in tests without binding a socket.
 */
export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const path = (req.url ?? '/').split('?')[0];

  if (path === '/healthz' || path === '/readyz') {
    json(res, 200, { status: 'ok' });
    return;
  }

  if (path === '/') {
    json(res, 200, { service: SERVICE_NAME, message: 'hello' });
    return;
  }

  json(res, 404, { error: 'not found' });
}

export function createServer(): Server {
  return createHttpServer(handleRequest);
}
