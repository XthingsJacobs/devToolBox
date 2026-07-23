export type RegexTab = 'test' | 'codegen';

export interface PresetRegex {
  label: string;
  pattern: string;
  flags?: string;
}

export const CODE_LANGUAGES = ['JavaScript', 'Python', 'Java', 'Go', 'C#', 'PHP', 'Ruby', 'Rust'] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export interface RegexMatch {
  start: number;
  end: number;
  text: string;
}

export interface RegexHighlightClasses {
  match: string;
  noMatch: string;
}

export type LocaleText = (key: string) => string;
