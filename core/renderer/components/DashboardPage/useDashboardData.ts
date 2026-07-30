import { useEffect, useState } from 'react';
import type { NetworkInfo } from '@devtoolbox/core';
import { appService, networkService } from '../../services';

export type DashboardAppInfo = { version?: string; build?: string };

export function useDashboardData() {
  const [now, setNow] = useState(() => new Date());
  const [appInfo, setAppInfo] = useState<DashboardAppInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void appService.getInfo()?.then((value) => {
      const result = value as { version?: unknown; build?: unknown };
      setAppInfo({
        version: typeof result?.version === 'string' ? result.version : undefined,
        build: typeof result?.build === 'string' ? result.build : undefined,
      });
    });
  }, []);

  useEffect(() => {
    const refresh = () => {
      void networkService.getNetworkInfo()?.then((value) => setNetworkInfo(value));
    };

    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return { now, appInfo, networkInfo };
}
