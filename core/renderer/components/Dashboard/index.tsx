import { useState, useEffect, useMemo } from 'react';
import styles from './Dashboard.module.css';
import { getCategories } from '../../data/placeholder';
import type { Category, Module } from '../../types';
import { useI18n } from '../../i18n';
import { loadModuleUsage, scoreUsage, subscribeModuleUsageUpdated } from '../../data/moduleUsage';
import { VscCopy, VscSearch } from 'react-icons/vsc';
import ToolCard from '../ToolCard';
import WorldClocks from './WorldClocks';

interface DashboardProps {
  onModuleSelect: (categoryId: string, moduleId: string) => void;
  onCategorySelect?: (categoryId: string) => void;
  onOpenGlobalSearch?: () => void;
  categories?: Category[];
}

interface AppInfo {
  name: string;
  company: string;
  version: string;
  build: string;
  electron: string;
  chrome: string;
  node: string;
}

interface NetworkInfo {
  localIPs: string[];
  publicIP: string;
  dnsStatus: string;
  internetStatus: string;
}

interface ScreenInfo {
  screenSize: string;
  orientation: string;
  orientationAngle: string;
  colorDepth: string;
  pixelRatio: string;
  windowSize: string;
}

interface DeviceInfo {
  vendor: string;
  languages: string;
  platform: string;
  userAgent: string;
}

function readScreenInfo(): ScreenInfo {
  const s = window.screen;
  const orientation = s?.orientation?.type ?? '';
  const orientationAngle = typeof s?.orientation?.angle === 'number' ? `${s.orientation.angle}°` : '';
  return {
    screenSize: s ? `${s.width} x ${s.height}` : '',
    orientation,
    orientationAngle,
    colorDepth: s && typeof s.colorDepth === 'number' ? `${s.colorDepth} bits` : '',
    pixelRatio: typeof window.devicePixelRatio === 'number' ? `${window.devicePixelRatio} dppx` : '',
    windowSize: `${window.innerWidth} x ${window.innerHeight}`,
  };
}

function readDeviceInfo(): DeviceInfo {
  const n = navigator;
  const languages = Array.isArray(n.languages) && n.languages.length ? n.languages.join(', ') : n.language ?? '';
  return {
    vendor: n.vendor ?? '',
    languages,
    platform: n.platform ?? '',
    userAgent: n.userAgent ?? '',
  };
}

export default function Dashboard({
  onModuleSelect,
  onCategorySelect,
  onOpenGlobalSearch,
  categories: injectedCategories,
}: DashboardProps) {
  const { locale, t } = useI18n();
  const categories = useMemo(() => injectedCategories ?? getCategories(locale), [injectedCategories, locale]);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [screenInfo, setScreenInfo] = useState<ScreenInfo>(() => readScreenInfo());
  const [deviceInfo] = useState<DeviceInfo>(() => readDeviceInfo());
  const [now, setNow] = useState(() => new Date());
  const [usageVersion, setUsageVersion] = useState(0);

  useEffect(() => {
    const api = window.electronAPI;
    if (api?.getAppInfo) void api.getAppInfo().then(setAppInfo);
    if (api?.getNetworkInfo) void api.getNetworkInfo().then(setNetworkInfo);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const update = () => setScreenInfo(readScreenInfo());
    window.addEventListener('resize', update);
    window.screen?.orientation?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.screen?.orientation?.removeEventListener?.('change', update);
    };
  }, []);

  useEffect(() => {
    return subscribeModuleUsageUpdated(() => setUsageVersion((v) => v + 1));
  }, []);

  const allModules = useMemo(() => {
    const result: { module: Module; categoryId: string; categoryName: string }[] = [];
    for (const cat of categories) {
      for (const mod of cat.modules) result.push({ module: mod, categoryId: cat.id, categoryName: cat.name });
    }
    return result;
  }, [categories]);

  const frequentModules = useMemo(() => {
    void usageVersion;
    const usage = loadModuleUsage();
    const index = new Map<string, { module: Module; categoryId: string; categoryName: string }>();
    for (const item of allModules) index.set(`${item.categoryId}:${item.module.id}`, item);
    return usage
      .map((u) => ({ u, item: index.get(`${u.categoryId}:${u.moduleId}`) }))
      .filter((x) => Boolean(x.item))
      .sort((a, b) => scoreUsage(b.u) - scoreUsage(a.u))
      .slice(0, 8)
      .map((x) => x.item!);
  }, [allModules, usageVersion]);

  const handleCopy = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
  };

  const loadingValue = t('dashboard.loading');
  const showValue = (v: string | undefined | null) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s ? s : loadingValue;
  };

  return (
    <main className={styles.dashboard} aria-label="Dashboard">
      <div className={styles.mainCol}>
        <div className={styles.hero}>
          <div className={styles.heroLabel}>DASHBOARD</div>
          <div className={styles.heroTitle}>Welcome back</div>
          <div className={styles.heroDate}>
            {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className={styles.searchSection}>
          <button
            type="button"
            className={styles.searchWrap}
            onClick={onOpenGlobalSearch}
            aria-label={t('dashboard.searchLabel')}
          >
            <span className={styles.searchIcon}>
              <VscSearch />
            </span>
            <span className={styles.searchPlaceholder}>{t('dashboard.searchPlaceholder')}</span>
            <kbd className={styles.shortcutHint}>⌘ K</kbd>
          </button>
        </div>

        <div className={styles.categoryRow}>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.categoryChip}
              onClick={() => onCategorySelect?.(c.id)}
            >
              <span className={styles.categoryChipIcon}>{c.icon}</span>
              <span className={styles.categoryChipLabel}>{c.name}</span>
              <span className={styles.categoryChipCount}>{c.modules.length}</span>
            </button>
          ))}
        </div>

        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{t('dashboard.frequentTools')}</h3>
        </div>
        <div className={styles.tileGrid}>
          {frequentModules.length > 0 ? (
            frequentModules.map((x) => (
              <ToolCard
                key={`${x.categoryId}:${x.module.id}`}
                icon={x.module.icon}
                name={x.module.name}
                meta={x.categoryName}
                onClick={() => onModuleSelect(x.categoryId, x.module.id)}
              />
            ))
          ) : (
            <div className={styles.emptyHint}>{t('dashboard.frequentEmpty')}</div>
          )}
        </div>

        <div className={styles.infoRow}>
        <div className={styles.col}>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>{t('dashboard.networkInfo')}</h3>
            <div className={`${styles.infoGrid} ${styles.singleCol}`}>
              <InfoItem
                label={t('dashboard.labelInternet')}
                value={
                  typeof networkInfo?.internetStatus === 'string' && networkInfo.internetStatus
                    ? networkInfo.internetStatus === 'Connected'
                      ? t('dashboard.networkConnected')
                      : t('dashboard.networkDisconnected')
                    : loadingValue
                }
                status={
                  typeof networkInfo?.internetStatus === 'string' && networkInfo.internetStatus
                    ? networkInfo.internetStatus === 'Connected'
                      ? 'ok'
                      : 'error'
                    : undefined
                }
              />
              <InfoItem
                label={t('dashboard.labelDns')}
                value={showValue(networkInfo?.dnsStatus)}
                status={
                  typeof networkInfo?.dnsStatus === 'string' && networkInfo.dnsStatus
                    ? networkInfo.dnsStatus === 'OK'
                      ? 'ok'
                      : 'error'
                    : undefined
                }
              />
              <InfoItem
                label={t('dashboard.labelPublicIP')}
                value={showValue(networkInfo?.publicIP)}
                copy={Boolean(networkInfo?.publicIP)}
                onCopy={handleCopy}
              />
              {Array.isArray(networkInfo?.localIPs) && networkInfo.localIPs.length ? (
                networkInfo.localIPs.map((ip, i) => (
                  <InfoItem
                    key={i}
                    label={i === 0 ? t('dashboard.labelLocalIP') : ''}
                    value={showValue(ip)}
                    copy={Boolean(ip)}
                    onCopy={handleCopy}
                  />
                ))
              ) : (
                <InfoItem label={t('dashboard.labelLocalIP')} value={loadingValue} />
              )}
            </div>
          </section>

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>{t('dashboard.screenInfo')}</h3>
            <div className={styles.infoGrid}>
              <InfoItem label={t('dashboard.labelScreenSize')} value={showValue(screenInfo.screenSize)} />
              <InfoItem label={t('dashboard.labelOrientation')} value={showValue(screenInfo.orientation)} />
              <InfoItem label={t('dashboard.labelOrientationAngle')} value={showValue(screenInfo.orientationAngle)} />
              <InfoItem label={t('dashboard.labelColorDepth')} value={showValue(screenInfo.colorDepth)} />
              <InfoItem label={t('dashboard.labelPixelRatio')} value={showValue(screenInfo.pixelRatio)} />
              <InfoItem label={t('dashboard.labelWindowSize')} value={showValue(screenInfo.windowSize)} />
            </div>
          </section>
        </div>

        <div className={styles.col}>
          <section className={styles.card}>
            <h3 className={styles.cardTitle}>{t('dashboard.appInfo')}</h3>
            <div className={`${styles.infoGrid} ${styles.singleCol}`}>
              <InfoItem
                label={t('dashboard.labelVersion')}
                value={showValue(appInfo?.version)}
                copy={Boolean(appInfo?.version)}
                onCopy={handleCopy}
              />
              <InfoItem
                label={t('dashboard.labelBuild')}
                value={showValue(appInfo?.build)}
                copy={Boolean(appInfo?.build)}
                onCopy={handleCopy}
              />
              <InfoItem
                label={t('dashboard.labelLocalTime')}
                value={appInfo ? now.toLocaleString() : loadingValue}
                copy={Boolean(appInfo)}
                onCopy={handleCopy}
              />
              <InfoItem
                label={t('dashboard.labelTimestamp')}
                value={appInfo ? String(Math.floor(now.getTime() / 1000)) : loadingValue}
                copy={Boolean(appInfo)}
                onCopy={handleCopy}
              />
              <InfoItem
                label={t('dashboard.labelTimezone')}
                value={appInfo ? Intl.DateTimeFormat().resolvedOptions().timeZone : loadingValue}
                copy={Boolean(appInfo)}
                onCopy={handleCopy}
              />
            </div>
          </section>

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>{t('dashboard.deviceInfo')}</h3>
            <div className={styles.infoGrid}>
              <InfoItem label={t('dashboard.labelBrowserVendor')} value={showValue(deviceInfo.vendor)} />
              <InfoItem label={t('dashboard.labelLanguages')} value={showValue(deviceInfo.languages)} fullRow />
              <InfoItem label={t('dashboard.labelPlatform')} value={showValue(deviceInfo.platform)} />
              <InfoItem label={t('dashboard.labelUserAgent')} value={showValue(deviceInfo.userAgent)} fullRow />
            </div>
          </section>
        </div>
        </div>
        <section className={styles.card}>
          <WorldClocks now={now} />
        </section>
      </div>

      <aside className={styles.rightCol} aria-label={t('dashboard.frequentTools')}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{t('dashboard.frequentTools')}</h3>
        </div>
        {frequentModules.length ? (
          <div className={styles.sideList}>
            {frequentModules.map(({ module, categoryId, categoryName }) => (
              <ToolCard
                key={`${categoryId}:${module.id}`}
                icon={module.icon}
                name={module.name}
                meta={`${categoryName}${module.description ? ` · ${module.description}` : ''}`}
                onClick={() => onModuleSelect(categoryId, module.id)}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyHint}>{t('dashboard.frequentEmpty')}</div>
        )}
      </aside>
    </main>
  );
}

function InfoItem({
  label,
  value,
  status,
  copy,
  onCopy,
  fullRow,
}: {
  label: string;
  value: string;
  status?: 'ok' | 'error';
  copy?: boolean;
  onCopy?: (v: string) => void;
  fullRow?: boolean;
}) {
  return (
    <div className={`${styles.infoItem}${fullRow ? ` ${styles.fullRow}` : ''}`}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue} title={value}>
        {status && <span className={status === 'ok' ? styles.statusOk : styles.statusError} />}
        {value}
        {copy ? (
          <button className={styles.copyBtn} onClick={() => onCopy?.(value)} aria-label="Copy">
            <VscCopy />
          </button>
        ) : null}
      </span>
    </div>
  );
}
