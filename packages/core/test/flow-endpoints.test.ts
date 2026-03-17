import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowEndpoints } from '../src/client/flow-endpoints.js';

describe('FlowEndpoints', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends auth when creating a workflow', async () => {
    const post = vi.fn().mockResolvedValue({
      result: {
        data: {
          json: {
            result: {
              projectId: 'project-123',
            },
          },
        },
      },
    });

    const endpoints = new FlowEndpoints({
      client: {
        getTrpcUrl: vi.fn().mockReturnValue('https://labs.google/fx/api/trpc/project.createProject'),
        post,
      } as any,
    });

    await endpoints.createWorkflow('debug-project');

    expect(post).toHaveBeenCalledWith(
      'https://labs.google/fx/api/trpc/project.createProject',
      {
        json: {
          projectTitle: 'debug-project',
          toolName: 'PINHOLE',
        },
      },
      {
        headers: {
          'content-type': 'application/json',
        },
      },
      { endpointClass: 'default', retries: 1 },
    );
  });
});
