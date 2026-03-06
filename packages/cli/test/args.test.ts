import { describe, expect, it } from 'vitest';
import {
  buildClientConfig,
  getBooleanOption,
  getStringArrayOption,
  parseCliArgs,
} from '../src/utils/args.js';

describe('cli args utils', () => {
  it('parses mixed positional and options', () => {
    const parsed = parseCliArgs([
      'rename',
      '--workflow-id',
      'wf-1',
      '--project-id=proj-1',
      '--flag',
      '--reference',
      'a,b',
      '--reference',
      'c',
    ]);

    expect(parsed.positionals).toEqual(['rename']);
    expect(parsed.options['workflow-id']).toBe('wf-1');
    expect(parsed.options['project-id']).toBe('proj-1');
    expect(getBooleanOption(parsed.options, 'flag')).toBe(true);
    expect(getStringArrayOption(parsed.options, 'reference')).toEqual(['a', 'b', 'c']);
  });

  it('builds compact client config', () => {
    const parsed = parseCliArgs(['--retries', '2', '--telemetry', 'disabled']);
    const config = buildClientConfig(parsed.options);

    expect(config.retries).toBe(2);
    expect(config.telemetryMode).toBe('disabled');
    expect(config.cookie).toBeUndefined();
  });
});
