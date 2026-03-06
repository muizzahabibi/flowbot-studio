import { describe, expect, it } from 'vitest';
import { createServer } from '../src/main.js';

describe('server', () => {
  it('returns health', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });

  it('returns model list', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/v1/models' });

    expect(response.statusCode).toBe(200);
    const payload = response.json() as { data: Array<{ id: string }> };
    expect(payload.data.length).toBeGreaterThan(0);

    await app.close();
  });
});
