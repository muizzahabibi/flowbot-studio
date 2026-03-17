import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface PlaywrightStorageStateCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export interface PlaywrightStorageStateOrigin {
  origin: string;
  localStorage: Array<{
    name: string;
    value: string;
  }>;
}

export interface PlaywrightStorageState {
  cookies: PlaywrightStorageStateCookie[];
  origins: PlaywrightStorageStateOrigin[];
}

interface RecoveryStateStoreInput {
  storageStatePath: string;
  profileKey: string;
}

export class RecoveryStateStore {
  readonly quarantinePath: string;

  constructor(private readonly input: RecoveryStateStoreInput) {
    this.quarantinePath = buildQuarantinePath(input.storageStatePath, input.profileKey);
  }

  async load(): Promise<PlaywrightStorageState | undefined> {
    let raw: string;

    try {
      raw = await readFile(this.input.storageStatePath, 'utf8');
    } catch (error) {
      if (isMissingFileError(error)) {
        return undefined;
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await this.quarantine('Storage state file contained invalid JSON');
      return undefined;
    }

    if (!isPlaywrightStorageState(parsed)) {
      await this.quarantine('Storage state file must include cookies[] and origins[] arrays');
      return undefined;
    }

    return parsed;
  }

  async save(state: PlaywrightStorageState): Promise<void> {
    if (!isPlaywrightStorageState(state)) {
      throw new Error('Recovery state save requires cookies[] and origins[] arrays');
    }

    const targetDir = dirname(this.input.storageStatePath);
    const tempPath = `${this.input.storageStatePath}.tmp-${process.pid}-${randomUUID()}`;

    await mkdir(targetDir, { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.input.storageStatePath);
  }

  async quarantine(reason: string): Promise<void> {
    await mkdir(dirname(this.quarantinePath), { recursive: true });

    let original = '';
    try {
      original = await readFile(this.input.storageStatePath, 'utf8');
      await writeFile(this.quarantinePath, original, 'utf8');
      await rm(this.input.storageStatePath, { force: true });
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
      await writeFile(this.quarantinePath, original, 'utf8');
    }

    await writeFile(`${this.quarantinePath}.reason`, redactReason(reason), 'utf8');
  }
}

function isPlaywrightStorageState(value: unknown): value is PlaywrightStorageState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.cookies) && Array.isArray(candidate.origins);
}

function buildQuarantinePath(storageStatePath: string, profileKey: string): string {
  const parsed = parse(storageStatePath);
  const safeProfileKey = sanitizeProfileKey(profileKey);
  const baseName = parsed.base || 'storage-state.json';
  return join(parsed.dir, `${baseName}.${safeProfileKey}.quarantine`);
}

function sanitizeProfileKey(profileKey: string): string {
  const trimmed = profileKey.trim();
  return trimmed.replace(/[^A-Za-z0-9._-]+/g, '_') || 'default';
}

function redactReason(reason: string): string {
  return reason
    .replace(/[A-Za-z]:[\\/][^\s]*/g, '[redacted-path]')
    .replace(/(?:^|\b)(?:[A-Za-z0-9!#$%&'*+.^_`|~-]+=)[^;\s]+/g, '[redacted-cookie]');
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT');
}
