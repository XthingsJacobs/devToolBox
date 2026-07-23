import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
  } catch {
    return undefined;
  }
}

export function writeJsonAtomic(filePath: string, data: unknown): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );
  let descriptor: number | undefined;

  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, serialized, 'utf-8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);

    try {
      const directoryDescriptor = fs.openSync(directory, 'r');
      try {
        fs.fsyncSync(directoryDescriptor);
      } finally {
        fs.closeSync(directoryDescriptor);
      }
    } catch {
      // Directory fsync is unavailable on some platforms; the atomic rename still applies.
    }
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}
