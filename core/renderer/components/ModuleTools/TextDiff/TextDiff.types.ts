export type DiffLineType = 'equal' | 'removed' | 'added' | 'modified' | 'empty' | 'sep';
export type DiffSide = 'left' | 'right';
export type LocaleText = (key: string) => string;

export interface WordPart {
  value: string;
  type: 'equal' | 'removed' | 'added';
}

export interface DiffLine {
  num?: number;
  content: string | WordPart[];
  type: DiffLineType;
}

export interface DiffPanes {
  leftLines: DiffLine[];
  rightLines: DiffLine[];
}

export interface DiffStats {
  added: number;
  removed: number;
}
