import { describe, expect, it } from 'vitest';
import { Prompt } from '../src/domain/prompt.js';

describe('Prompt', () => {
  it('applies defaults', () => {
    const prompt = new Prompt({ prompt: 'A cat in space' });
    expect(prompt.model).toBe('NARWHAL');
    expect(prompt.aspectRatio).toBe('IMAGE_ASPECT_RATIO_LANDSCAPE');
    expect(prompt.count).toBe(1);
    expect(prompt.toStructuredPrompt()).toEqual({ parts: [{ text: 'A cat in space' }] });
  });

  it('throws for invalid count', () => {
    expect(() => new Prompt({ prompt: 'x', count: 0 })).toThrow('count must be between 1 and 8');
    expect(() => new Prompt({ prompt: 'x', count: 9 })).toThrow('count must be between 1 and 8');
  });
});
