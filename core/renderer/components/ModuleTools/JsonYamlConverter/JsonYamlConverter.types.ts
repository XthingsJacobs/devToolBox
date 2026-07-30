import type { FileFilter, OpenFileResult } from '@devtoolbox/core';

export type JsonYamlMode = 'jsonToYaml' | 'yamlToJson';
export type LocaleText = (key: string) => string;
export type OpenTextFile = (filters: FileFilter[]) => Promise<OpenFileResult | null> | undefined;

export interface TextStats {
  length: number;
  spaces: number;
  lines: number;
}

export type ConversionResult =
  { ok: true; output: string } | { ok: false; errorKind: 'json' | 'yaml'; message: string };
