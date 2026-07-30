import { useEffect, useMemo, useState } from 'react';
import { loadModuleUsage, scoreUsage, subscribeModuleUsageUpdated } from '../../data/moduleUsage';
import type { Category } from '../../types';
import {
  flattenDashboardTools,
  pickFrequentDashboardTools,
  searchDashboardTools,
  type FlatTool,
} from './DashboardPage.model';

export function useDashboardTools(
  categories: Category[],
  query: string,
): {
  flatTools: FlatTool[];
  searchResults: FlatTool[];
  frequent: FlatTool[];
} {
  const [usage, setUsage] = useState(() => loadModuleUsage());

  useEffect(() => {
    return subscribeModuleUsageUpdated(() => setUsage(loadModuleUsage()));
  }, []);

  const flatTools = useMemo(() => flattenDashboardTools(categories), [categories]);
  const searchResults = useMemo(() => searchDashboardTools(flatTools, query), [flatTools, query]);
  const frequent = useMemo(
    () => pickFrequentDashboardTools(flatTools, usage, scoreUsage),
    [flatTools, usage],
  );

  return { flatTools, searchResults, frequent };
}
