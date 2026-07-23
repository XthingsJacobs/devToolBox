import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { VscCopy } from 'react-icons/vsc';
import { ToolButton, ToolField, ToolTextarea } from '@@components';
import SafeHtml from '../../SafeHtml';
import { highlightJson } from './JwtTool.model';
import type { VerifyMessage } from './JwtTool.types';
import styles from './JwtTool.module.css';

export function Block({
  title,
  copyLabel,
  onCopy,
  children,
}: {
  title: string;
  copyLabel: string;
  onCopy?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.blk}>
      <div className={styles.blkH}>
        <span>{title}</span>
        {onCopy && (
          <ToolButton className={styles.cpBtn} onClick={onCopy}>
            <VscCopy />
            {copyLabel}
          </ToolButton>
        )}
      </div>
      <div className={styles.blkB}>{children}</div>
    </div>
  );
}

export function JsonBlock({
  title,
  value,
  copyLabel,
  onCopy,
}: {
  title: string;
  value: string;
  copyLabel: string;
  onCopy?: () => void;
}) {
  return (
    <Block title={title} copyLabel={copyLabel} onCopy={onCopy}>
      <SafeHtml as="pre" className={styles.hl} html={highlightJson(value)} profile="syntax" />
    </Block>
  );
}

export function JsonArea({
  value,
  onChange,
  rows,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const isValid = useMemo(() => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, [value]);
  if (editing || !isValid) {
    return (
      <ToolField label={label}>
        <ToolTextarea
          mono
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          spellCheck={false}
          rows={rows}
          autoFocus={editing}
        />
      </ToolField>
    );
  }
  const formatted = JSON.stringify(JSON.parse(value), null, 2);
  return (
    <ToolField label={label}>
      <div className={styles.jsonPreview} onClick={() => setEditing(true)}>
        <SafeHtml as="pre" className={styles.hl} html={highlightJson(formatted)} profile="syntax" />
      </div>
    </ToolField>
  );
}

export function VerifyBadges({ messages }: { messages: VerifyMessage[] }) {
  if (!messages.length) return null;
  return (
    <div className={styles.verifyRow}>
      {messages.map((message, index) => (
        <span key={index} className={`${styles.badge} ${styles[`b_${message.type}`]}`}>
          {message.msg}
        </span>
      ))}
    </div>
  );
}
