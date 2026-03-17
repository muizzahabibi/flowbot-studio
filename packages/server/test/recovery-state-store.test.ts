import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RecoveryStateStore, type PlaywrightStorageState } from '../src/services/recovery-state-store.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('RecoveryStateStore', () => {
  it('writes state atomically and reloads it for one profile key', async () => {
    const dir = await createTempDir();
    const storageStatePath = join(dir, 'storage-state.json');
    const store = new RecoveryStateStore({ storageStatePath, profileKey: 'profile-a' });
    const state: PlaywrightStorageState = {
      cookies: [
        {
          name: 'SID',
          value: 'super-secret-cookie',
          domain: '.google.com',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    };

    await store.save(state);

    await expect(store.load()).resolves.toEqual(state);
    await expect(stat(storageStatePath)).resolves.toMatchObject({ isFile: expect.any(Function) });

    const dirEntries = await readdir(dir);
    expect(dirEntries).not.toContain('storage-state.json.tmp');
    expect(dirEntries.filter((entry) => entry.startsWith('storage-state.json.tmp-'))).toEqual([]);
  });

  it('quarantines invalid JSON state files', async () => {
    const dir = await createTempDir();
    const storageStatePath = join(dir, 'storage-state.json');
    await writeFile(storageStatePath, '{"cookies":[', 'utf8');
    const store = new RecoveryStateStore({ storageStatePath, profileKey: 'default' });

    await expect(store.load()).resolves.toBeUndefined();

    const quarantinePath = store.quarantinePath;
    await expect(readFile(quarantinePath, 'utf8')).resolves.toBe('{"cookies":[');
    await expect(stat(storageStatePath)).rejects.toThrow();
    expect(quarantinePath).toContain('default');
    expect(quarantinePath).toMatch(/default\.quarantine$/);
  });

  it('quarantines malformed JSON state that lacks cookies/origins arrays', async () => {
    const dir = await createTempDir();
    const storageStatePath = join(dir, 'storage-state.json');
    const malformed = JSON.stringify({ cookies: {}, origins: 'bad', note: 'SID=super-secret-cookie' });
    await writeFile(storageStatePath, malformed, 'utf8');
    const store = new RecoveryStateStore({ storageStatePath, profileKey: 'profile-b' });

    await expect(store.load()).resolves.toBeUndefined();

    const quarantinePath = store.quarantinePath;
    await expect(readFile(quarantinePath, 'utf8')).resolves.toBe(malformed);
    await expect(stat(storageStatePath)).rejects.toThrow();
    expect(quarantinePath).toContain('profile-b');
  });

  it('quarantine writes original bad content and keeps reason details redacted', async () => {
    const dir = await createTempDir();
    const storageStatePath = join(dir, 'state.json');
    const poisoned = 'SID=super-secret-cookie';
    await writeFile(storageStatePath, poisoned, 'utf8');
    const store = new RecoveryStateStore({ storageStatePath, profileKey: 'redact-me' });

    await store.quarantine(`Failed to load ${storageStatePath} with cookie ${poisoned}`);

    const quarantinePath = store.quarantinePath;
    await expect(readFile(quarantinePath, 'utf8')).resolves.toBe(poisoned);
    await expect(readFile(`${quarantinePath}.reason`, 'utf8')).resolves.toContain('Failed to load [redacted-path] with cookie [redacted-cookie]');
    await expect(readFile(`${quarantinePath}.reason`, 'utf8')).resolves.not.toContain(storageStatePath);
    await expect(readFile(`${quarantinePath}.reason`, 'utf8')).resolves.not.toContain(poisoned);
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'recovery-state-store-'));
  tempDirs.push(dir);
  return dir;
}
