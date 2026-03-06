import fs from 'node:fs';
import path from 'node:path';

function sanitize(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]')
    .replace(/(__Secure-next-auth\.session-token=)[^;\s]+/gi, '$1[REDACTED]')
    .replace(/(Signature=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(GoogleAccessId=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(Expires=)[^&\s]+/gi, '$1[REDACTED]');
}

export function printInfo(message: string): void {
  process.stdout.write(`${sanitize(message)}\n`);
}

export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function printError(error: unknown): void {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);
  process.stderr.write(`${sanitize(message)}\n`);
}

export function ensureDirectory(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeBinaryFile(filePath: string, data: Buffer): void {
  const targetDir = path.dirname(filePath);
  ensureDirectory(targetDir);
  fs.writeFileSync(filePath, data);
}

export function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'image/jpeg';
}
