import { describe, expect, it, vi } from 'vitest';
import { OpenAIImageAdapter } from '../src/adapters/openai-image-adapter.js';

describe('OpenAIImageAdapter', () => {
  it('maps generated images to OpenAI-style response', async () => {
    const fakeProject = {
      generateImageWithReferences: vi.fn().mockResolvedValue({
        imagePanels: [
          {
            generatedImages: [{ mediaGenerationId: 'm1', encodedImage: 'abc123', prompt: 'p1' }],
          },
        ],
      }),
      uploadReference: vi.fn(),
    };

    const adapter = new OpenAIImageAdapter({
      projectFactory: () => fakeProject as never,
    });

    const result = await adapter.generate({
      model: 'nano-banana',
      prompt: 'hello',
      project_id: 'proj-1',
      recaptcha_token: 'recaptcha-token',
      response_format: 'b64_json',
    });

    expect(result.data[0]?.b64_json).toBe('abc123');
    expect(result.data[0]?.media_id).toBe('m1');
    expect(fakeProject.generateImageWithReferences).toHaveBeenCalled();
  });

  it('requires project_id', async () => {
    const adapter = new OpenAIImageAdapter({
      projectFactory: () => ({}) as never,
    });

    await expect(
      adapter.generate({
        model: 'nano-banana',
        prompt: 'hello',
      }),
    ).rejects.toThrow('project_id is required');
  });
});
