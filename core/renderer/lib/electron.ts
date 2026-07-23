import type { ElectronAPI } from '@devtoolbox/core';

export function getElectronApi(): ElectronAPI | undefined {
  return window.electronAPI;
}

export function hasElectronApi(): boolean {
  return Boolean(getElectronApi());
}
