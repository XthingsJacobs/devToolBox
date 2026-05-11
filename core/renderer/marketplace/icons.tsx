import type { ReactNode } from 'react';
import { VscArrowSwap, VscCircuitBoard, VscExtensions, VscLocation } from 'react-icons/vsc';
import { resolveIconKey } from '../icons/iconKey';

export function marketplacePluginIcon(id: string): ReactNode {
  if (id === 'market-matter-catalog') return <VscCircuitBoard />;
  if (id === 'market-ip-lookup') return <VscLocation />;
  if (id === 'market-exchange-rate') return <VscArrowSwap />;
  return <VscExtensions />;
}

export function marketplacePluginIconFromManifest(manifest: { id: string; icon?: unknown; iconKey?: unknown }): ReactNode {
  const iconKey = typeof manifest.iconKey === 'string' ? manifest.iconKey.trim() : '';
  const keyIcon = resolveIconKey(iconKey);
  if (keyIcon) return keyIcon;
  const icon = typeof manifest.icon === 'string' ? manifest.icon.trim() : '';
  if (icon) return <img src={icon} alt="" width={16} height={16} draggable={false} />;
  return marketplacePluginIcon(manifest.id);
}
