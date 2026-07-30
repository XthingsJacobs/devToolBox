import { useEffect, useState } from 'react';
import { APP_VERSION } from '../../appVersion';
import {
  ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL,
  loadMarketplaceRegistryUrl,
} from '../../marketplace/registry';
import { appService } from '../../services';
import type { SectionId } from './SettingsPage.model';

export function useSettingsPageState(initialSection: SectionId) {
  const [active, setActive] = useState<SectionId>(initialSection);
  const [versionText, setVersionText] = useState(`v${APP_VERSION}`);
  const [registryUrl, setRegistryUrl] = useState('');

  useEffect(() => {
    void appService.getInfo()?.then((value) => {
      const version = typeof value?.version === 'string' ? value.version : '';
      if (version) setVersionText(`v${version}`);
    });
  }, []);

  useEffect(() => {
    if (ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL) setRegistryUrl(loadMarketplaceRegistryUrl());
  }, []);

  useEffect(() => {
    setActive(initialSection);
  }, [initialSection]);

  return {
    active,
    setActive,
    versionText,
    registryUrl,
    setRegistryUrl,
  };
}
