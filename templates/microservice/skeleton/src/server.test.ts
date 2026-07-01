import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer } from './server';

let server: Server | undefined;

async function listen(): Promise<string> {
  server = createServer();
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server!.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});

describe('request handling', () => {
  it('reports healthy on the liveness endpoint', async () => {
    const base = await listen();
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('reports ready on the readiness endpoint', async () => {
    const base = await listen();
    const res = await fetch(`${base}/readyz`);
    expect(res.status).toBe(200);
  });

  it('serves the root endpoint', async () => {
    const base = await listen();
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: string };
    expect(body).toHaveProperty('service');
  });

  it('returns 404 for unknown routes', async () => {
    const base = await listen();
    const res = await fetch(`${base}/does-not-exist`);
    expect(res.status).toBe(404);
  });
});
