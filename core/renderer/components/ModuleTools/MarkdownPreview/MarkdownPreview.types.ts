import type { FileFilter, OpenFileResult } from '@devtoolbox/core';

export type LocaleText = (key: string) => string;

export interface MarkdownFileBridge {
  isAvailable: () => boolean;
  openFile: (filters?: FileFilter[], encoding?: string) => Promise<OpenFileResult | null> | undefined;
  saveFile: (filePath: string, content: string) => Promise<boolean> | undefined;
  saveFileAs: (
    defaultName: string,
    content: string,
    filters?: FileFilter[],
  ) => Promise<string | null> | undefined;
  confirmOverwrite: (filePath: string) => Promise<boolean> | undefined;
}

export interface MarkdownTextStats {
  length: number;
  lines: number;
}

export interface MarkdownPreviewPalette {
  bg: string;
  text: string;
  border: string;
  muted: string;
  codeBg: string;
  link: string;
}

export type MarkdownFileFilter = FileFilter;
