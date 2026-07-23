import type { FileFilter } from '@devtoolbox/core';

export type UuidVersion = 'nil' | 'v1' | 'v3' | 'v4' | 'v5';
export type NamespacePreset = 'dns' | 'url' | 'oid' | 'x500' | 'custom';
export type LocaleText = (key: string) => string;
export type SaveTextFile = (
  defaultName: string,
  content: string,
  filters?: FileFilter[],
) => Promise<string | null> | undefined;

export type V1State = {
  node: Uint8Array;
  clockSeq: number;
  lastTime: bigint;
};
