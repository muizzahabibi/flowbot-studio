import { describe, expect, it } from 'vitest';
import { guessMimeType } from '../src/utils/output.js';

describe('output utils', () => {
  it('guesses mime type from file extension', () => {
    expect(guessMimeType('x.png')).toBe('image/png');
    expect(guessMimeType('x.jpeg')).toBe('image/jpeg');
    expect(guessMimeType('x.webp')).toBe('image/webp');
    expect(guessMimeType('x.unknown')).toBe('image/jpeg');
  });
});
