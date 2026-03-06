import { describe, expect, it, vi } from 'vitest';
import { FlowTelemetry } from '../src/telemetry/flow-telemetry.js';
import type { FlowHttpClient } from '../src/client/flow-http-client.js';

describe('FlowTelemetry', () => {
  it('does not send when disabled', async () => {
    const post = vi.fn();
    const client = {
      getApiUrl: (path: string) => `https://example.com${path}`,
      post,
    } as unknown as FlowHttpClient;

    const telemetry = new FlowTelemetry({ mode: 'disabled', client });
    await telemetry.sendBatchLog([{ event: 'E' }]);

    expect(post).not.toHaveBeenCalled();
  });

  it('sends events when enabled', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const client = {
      getApiUrl: (path: string) => `https://example.com${path}`,
      post,
    } as unknown as FlowHttpClient;

    const telemetry = new FlowTelemetry({ mode: 'enabled', client });
    await telemetry.sendFrontendEvents([{ eventType: 'CLICK' }]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toContain('/v1/flow:batchLogFrontendEvents');
  });
});
