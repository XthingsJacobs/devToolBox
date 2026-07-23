export type SortOrder = 'none' | 'asc' | 'desc';
export type OutputViewMode = 'tree' | 'text';

export interface TextStats {
  length: number;
  spaces: number;
  newlines: number;
}

export interface TextMatch {
  start: number;
  end: number;
}

export type JsonInputParseResult = { ok: true; parsed: unknown } | { ok: false; error: string };

export type LocaleText = (key: string) => string;
