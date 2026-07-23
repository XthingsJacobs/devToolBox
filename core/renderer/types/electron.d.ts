import type { ElectronAPI } from '@devtoolbox/core';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
