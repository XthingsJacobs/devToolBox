import type { Category, Module } from '../types';
import type { Locale } from '../i18n/types';
import { getCategoryName, getModuleLocale } from '../i18n';
import { createElement } from 'react';
import { VscCode, VscSymbolString, VscGlobe, VscShield, VscEllipsis } from 'react-icons/vsc';
import { resolveIconKey } from '../icons/iconKey';

export interface CoreToolManifest {
  id: string;
  name: string;
  description: string;
  sdkVersion: string;
  entry: string;
  categoryId: string;
  author?: string;
  icon?: string;
  iconKey?: string;
  permissions?: string[];
  homepage?: string;
  repository?: string;
  license?: string;
}

const manifestModules = import.meta.glob<{ default: CoreToolManifest }>(
  ['../components/ModuleTools/*/manifest.json'],
  { eager: true },
);

const entryModules = {
  ...import.meta.glob('../components/ModuleTools/*/index.tsx'),
  ...import.meta.glob('../components/ModuleTools/*/entry.tsx'),
} as Record<string, () => Promise<{ default: React.ComponentType }>>;

interface CoreToolWithFolder extends CoreToolManifest {
  _folderName: string;
  _entryPath?: string;
  _pluginEntryRel?: string;
}

const CORE_TOOL_ASSET_PREFIX = '__core_tools__';

function normalizeEntryPath(folderName: string, entry: string | undefined): string | undefined {
  const cleaned = typeof entry === 'string' && entry.trim() ? entry.trim().replace(/^\.\/+/, '') : 'index.tsx';
  if (cleaned.toLowerCase().endsWith('.html')) return undefined;
  const candidate = `../components/ModuleTools/${folderName}/${cleaned}`;
  if (candidate in entryModules) return candidate;
  const fallbackIndex = `../components/ModuleTools/${folderName}/index.tsx`;
  if (fallbackIndex in entryModules) return fallbackIndex;
  const fallbackEntry = `../components/ModuleTools/${folderName}/entry.tsx`;
  if (fallbackEntry in entryModules) return fallbackEntry;
  return candidate;
}

const coreToolsWithFolder: CoreToolWithFolder[] = Object.entries(manifestModules).map(([filePath, m]) => {
  const parts = filePath.split('/');
  const folderName = parts[parts.length - 2];
  const entryCleaned = typeof m.default.entry === 'string' ? m.default.entry.trim().replace(/^\.\/+/, '') : '';
  const isPlugin = entryCleaned.toLowerCase().endsWith('.html');
  return {
    ...m.default,
    _folderName: folderName,
    _entryPath: isPlugin ? undefined : normalizeEntryPath(folderName, m.default.entry),
    _pluginEntryRel: isPlugin ? entryCleaned : undefined,
  };
});

export const moduleEntryLoaderMap = new Map<string, () => Promise<{ default: React.ComponentType }>>(
  coreToolsWithFolder
    .filter((t) => typeof t.id === 'string' && t.id)
    .filter((t) => typeof t._entryPath === 'string' && typeof entryModules[t._entryPath] === 'function')
    .map((t) => [t.id, entryModules[t._entryPath as string]]),
);

export const modulePluginEntryUrlMap = new Map<string, string>(
  coreToolsWithFolder
    .filter((t) => typeof t.id === 'string' && t.id)
    .filter((t) => typeof t._pluginEntryRel === 'string' && t._pluginEntryRel)
    .map((t) => [t.id, `./${CORE_TOOL_ASSET_PREFIX}/${t._folderName}/${t._pluginEntryRel}`]),
);

/** Top-level categories (fixed) */
export const categoryDefs: { id: string; icon: React.ReactNode }[] = [
  { id: 'dev-tools', icon: createElement(VscCode) },
  { id: 'text-tools', icon: createElement(VscSymbolString) },
  { id: 'network-tools', icon: createElement(VscGlobe) },
  { id: 'security-tools', icon: createElement(VscShield) },
  { id: 'other-tools', icon: createElement(VscEllipsis) },
];

/** Get localized categories and modules by locale */
export function getCategories(locale: Locale): Category[] {
  const modulesByCategory = new Map<string, Module[]>();
  for (const tool of coreToolsWithFolder) {
    const localeData = getModuleLocale(locale, tool._folderName);
    const list = modulesByCategory.get(tool.categoryId) ?? [];
    list.push({
      id: tool.id,
      name: localeData?.name ?? tool.name,
      description: localeData?.description ?? tool.description,
      categoryId: tool.categoryId,
      icon:
        resolveIconKey(tool.iconKey) ??
        (typeof tool.icon === 'string' && tool.icon.trim()
          ? createElement('img', { src: tool.icon.trim(), alt: '', width: 16, height: 16, draggable: false })
          : null),
    });
    modulesByCategory.set(tool.categoryId, list);
  }

  return categoryDefs.map((cat) => ({
    id: cat.id,
    name: getCategoryName(locale, cat.id),
    icon: cat.icon,
    modules: modulesByCategory.get(cat.id) ?? [],
  }));
}

/** Backward compatibility: default to English */
export const categories: Category[] = getCategories('en');
