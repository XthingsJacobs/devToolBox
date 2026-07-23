import type { FileFilter, OpenFileResult } from '@devtoolbox/core';
import { getElectronApi, hasElectronApi } from '../lib/electron';

export const fileService = {
  isAvailable(): boolean {
    return hasElectronApi();
  },

  openFile(filters?: FileFilter[], encoding?: string): Promise<OpenFileResult | null> | undefined {
    return getElectronApi()?.openFile(filters, encoding);
  },

  saveFile(filePath: string, content: string): Promise<boolean> | undefined {
    return getElectronApi()?.saveFile(filePath, content);
  },

  saveFileAs(
    defaultName: string,
    content: string,
    filters?: FileFilter[],
  ): Promise<string | null> | undefined {
    return getElectronApi()?.saveFileAs(defaultName, content, filters);
  },

  confirmOverwrite(filePath: string): Promise<boolean> | undefined {
    return getElectronApi()?.confirmOverwrite(filePath);
  },
};
