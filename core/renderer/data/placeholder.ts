import type { Category, Module, ModuleConfig } from '../types';
import type { Locale } from '../i18n/types';
import { getCategoryName, getModuleLocale } from '../i18n';
import { createElement } from 'react';
import { VscCode, VscSymbolString, VscGlobe, VscShield, VscEllipsis } from 'react-icons/vsc';

/**
 * Auto-scan all config.ts(x) files under ModuleTools via import.meta.glob.
 * Vite resolves eager glob imports at build time.
 */
const configModules = import.meta.glob<{ default: ModuleConfig }>(
  [
    '../components/ModuleTools/*/config.tsx',
  ],
  { eager: true },
);

/** All module configs (auto-aggregated), with folder name attached */
interface ModuleConfigWithFolder extends ModuleConfig {
  _folderName: string;
}

const moduleConfigsWithFolder: ModuleConfigWithFolder[] = Object.entries(configModules).map(
  ([filePath, m]) => {
    // Example path: ../components/ModuleTools/Base64Codec/config.ts
    const parts = filePath.split('/');
    const folderName = parts[parts.length - 2]; // e.g. "Base64Codec"
    return { ...m.default, _folderName: folderName };
  },
);

/** All module configs (auto-aggregated) */
export const moduleConfigs: ModuleConfig[] = moduleConfigsWithFolder;

/** Fast lookup by id */
export const moduleComponentMap = new Map<string, React.ComponentType>(
  moduleConfigs.map((c) => [c.id, c.component]),
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
  for (const cfg of moduleConfigsWithFolder) {
    const localeData = getModuleLocale(locale, cfg._folderName);
    const list = modulesByCategory.get(cfg.categoryId) ?? [];
    list.push({
      id: cfg.id,
      name: localeData?.name ?? cfg.name,
      description: localeData?.description ?? cfg.description,
      categoryId: cfg.categoryId,
      icon: cfg.icon,
    });
    modulesByCategory.set(cfg.categoryId, list);
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
