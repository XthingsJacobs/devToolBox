import { useEffect, useMemo, useState } from 'react';
import styles from './AboutDialog.module.css';
import { VscClose, VscGithub, VscGlobe, VscMail, VscSparkle } from 'react-icons/vsc';

type AppInfo = {
  name: string;
  company: string;
  version: string;
  build: string;
};

export default function AboutDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [iconSmallUrl, setIconSmallUrl] = useState<string | null>(null);
  const [iconLargeUrl, setIconLargeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const api = window.electronAPI;
    if (!api?.getAppInfo) return;
    void api.getAppInfo().then((v) => setInfo(v as AppInfo));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const api = window.electronAPI;
    if (!api?.getAppIcon) return;
    void api.getAppIcon('normal').then((v) => setIconSmallUrl(typeof v === 'string' ? v : null));
    void api.getAppIcon('large').then((v) => setIconLargeUrl(typeof v === 'string' ? v : null));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const title = useMemo(() => info?.name ?? 'DevToolBox', [info]);
  const versionText = useMemo(() => {
    if (!info) return 'Version -';
    return `Version ${info.version} (Build ${info.build})`;
  }, [info]);

  if (!isOpen) return null;

  return (
    <>
      <div className={`${styles.backdrop} fade-in`} onClick={onClose} />
      <div className={`${styles.dialog} slide-up`} role="dialog" aria-modal="true" aria-label="About">
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerBadge}>
              {iconSmallUrl ? <img className={styles.appIconSmall} src={iconSmallUrl} alt="" /> : <VscSparkle size={16} />}
            </div>
            <h2 className={styles.headerTitle}>About {title}</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <VscClose size={14} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.hero}>
            <div className={styles.heroIcon}>
              {iconLargeUrl ? <img className={styles.appIconLarge} src={iconLargeUrl} alt="" /> : <VscSparkle size={36} />}
            </div>
            <div className={styles.heroTitle}>{title}</div>
            <div className={styles.heroSub}>Developer Productivity Suite</div>
            <div className={styles.heroMeta}>{versionText}</div>
          </div>

          <div className={styles.desc}>
            A comprehensive collection of developer tools designed to streamline your workflow. From encoding/decoding utilities to text formatting and network diagnostics.
          </div>

          <div className={styles.grid}>
            <InfoItem label="License" value="MIT License" />
            <InfoItem label="Platform" value="Cross-platform" />
            <InfoItem label="Framework" value="React + TypeScript" />
            <InfoItem label="Last Updated" value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
          </div>

          <div className={styles.links}>
            <LinkButton icon={<VscGithub size={14} />} label="View on GitHub" href="https://github.com/devtoolbox" />
            <LinkButton icon={<VscGlobe size={14} />} label="Official Website" href="https://devtoolbox.dev" />
            <LinkButton icon={<VscMail size={14} />} label="Contact Support" href="mailto:support@devtoolbox.dev" />
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerText}>© {new Date().getFullYear()} {title}. All rights reserved.</div>
          <button type="button" className={styles.footerBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoItem}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  );
}

function LinkButton({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a className={styles.linkBtn} href={href} target="_blank" rel="noopener noreferrer">
      <span className={styles.linkIcon}>{icon}</span>
      <span>{label}</span>
    </a>
  );
}
