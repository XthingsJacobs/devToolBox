import type { FileFilter, OpenFileResult } from '@devtoolbox/core';

export type LocaleText = (key: string) => string;

export interface HtmlFileBridge {
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

export interface HtmlTextStats {
  length: number;
  lines: number;
}
