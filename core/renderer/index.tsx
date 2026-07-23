import React from 'react';
import { createRoot } from 'react-dom/client';
import type { StartupStatus } from '@devtoolbox/core';
import { installRendererDiagnostics, recordDiagnostic } from './lib/diagnostics';
import { appService } from './services';

installRendererDiagnostics();

const container = document.getElementById('root');
if (container) {
  const normalStartup: StartupStatus = {
    safeMode: false,
    reason: null,
    consecutiveFailures: 0,
    failureThreshold: 2,
    startedAt: new Date().toISOString(),
  };
  const bootstrap = async () => {
    const startupStatus = (await appService.getStartupStatus()?.catch(() => normalStartup)) ?? normalStartup;
    const { default: App } = await import('./App');
    createRoot(container).render(
      <React.StrictMode>
        <App startupStatus={startupStatus} />
      </React.StrictMode>,
    );
  };

  void bootstrap().catch((error: unknown) => {
    recordDiagnostic({
      level: 'error',
      source: 'renderer',
      scope: 'bootstrap',
      message: error instanceof Error ? error.message : 'Renderer bootstrap failed',
      details: error,
    });
    console.error('Renderer bootstrap failed:', error);
  });
}
