import { useMemo } from 'react';
import { marked } from 'marked';
import './Base64Help.css';
import SafeHtml from '../../SafeHtml';
import { getModuleLocale, useI18n } from '../../../i18n';

import helpEn from './i18n/help-en.md?raw';
import helpZhCN from './i18n/help-zh-CN.md?raw';

interface Base64HelpProps {
  onClose: () => void;
}

export default function Base64Help({ onClose }: Base64HelpProps) {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'Base64Codec');
  const mt = (key: string) => localeData?.[key] ?? key;
  const html = useMemo(() => {
    return marked.parse(locale === 'zh-CN' ? helpZhCN : helpEn, { breaks: true, gfm: true }) as string;
  }, [locale]);

  return (
    <div className="b64-help-overlay" onClick={onClose}>
      <div className="b64-help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="b64-help-header">
          <span>{mt('helpTitle')}</span>
          <button className="b64-help-close" onClick={onClose} aria-label={mt('helpTitle')}>
            ✕
          </button>
        </div>
        <SafeHtml className="b64-help-body" html={html} profile="rich-text" />
      </div>
    </div>
  );
}
