import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readJsonFile, writeJsonAtomic } from '../atomic-json';

const temporaryDirectories: string[] = [];

function temporaryFile(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-json-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'state.json');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('atomic JSON storage', () => {
  it('writes and replaces a JSON document', () => {
    const filePath = temporaryFile();

    writeJsonAtomic(filePath, { version: 1 });
    expect(readJsonFile(filePath)).toEqual({ version: 1 });

    writeJsonAtomic(filePath, { version: 2, enabled: true });
    expect(readJsonFile(filePath)).toEqual({ version: 2, enabled: true });
  });

  it('preserves the existing file when serialization fails', () => {
    const filePath = temporaryFile();
    writeJsonAtomic(filePath, { version: 1 });

    expect(() => writeJsonAtomic(filePath, { invalid: BigInt(1) })).toThrow();
    expect(readJsonFile(filePath)).toEqual({ version: 1 });
    expect(fs.readdirSync(path.dirname(filePath))).toEqual(['state.json']);
  });
});
