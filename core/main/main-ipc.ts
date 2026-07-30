import type { StartupStatus } from '@devtoolbox/core';
import { register as registerAppIpc } from './ipc/app';
import { register as registerBackupIpc } from './ipc/backup';
import { register as registerDiagnosticsIpc } from './ipc/diagnostics';
import { register as registerFileIpc } from './ipc/file';
import { register as registerLocaleIpc, broadcastLocaleChange, getCurrentLocale } from './ipc/locale';
import { register as registerMarketplaceIpc } from './ipc/marketplace';
import { register as registerStartupIpc } from './ipc/startup';
import { register as registerThemeIpc, broadcastThemeChange, getCurrentTheme } from './ipc/theme';
import type { DiagnosticStore } from './diagnostics';
import type { StartupHealthTracker } from './startup-health';

const moduleIpcFiles = import.meta.glob<{ register: () => void }>(['./modules/*.ts'], { eager: true });

export function registerMainIpc({
  appVersion,
  buildNumber,
  diagnostics,
  startupHealth,
  startupStatus,
  rebuildMenu,
}: {
  appVersion: string;
  buildNumber: string;
  diagnostics: DiagnosticStore;
  startupHealth: StartupHealthTracker;
  startupStatus: StartupStatus;
  rebuildMenu: () => void;
}): void {
  registerLocaleIpc((locale) => {
    void locale;
    broadcastLocaleChange(getCurrentLocale());
    rebuildMenu();
  });
  registerThemeIpc((theme) => {
    void theme;
    broadcastThemeChange(getCurrentTheme());
    rebuildMenu();
  });
  registerFileIpc();
  registerAppIpc(appVersion, buildNumber);
  registerDiagnosticsIpc(diagnostics, {
    version: appVersion,
    build: buildNumber,
    startupStatus,
  });
  registerStartupIpc(startupHealth);
  registerMarketplaceIpc(
    (event) => diagnostics.record(event),
    () => !startupStatus.safeMode,
  );
  registerBackupIpc();

  const registeredIpc = new Set<() => void>();
  for (const [, module] of Object.entries(moduleIpcFiles)) {
    const registerFn = module.register;
    if (typeof registerFn === 'function' && !registeredIpc.has(registerFn)) {
      const fn = registerFn;
      registeredIpc.add(fn);
      fn();
    }
  }
}
