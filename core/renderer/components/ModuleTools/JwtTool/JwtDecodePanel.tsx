import { useMemo, useState, type ChangeEvent } from 'react';
import { VscSearch } from 'react-icons/vsc';
import { ToolSection, ToolTextarea } from '@@components';
import { Block, JsonBlock } from './JwtBlocks';
import { decodeJwt } from './JwtTool.model';
import type { JwtCopyHandler, JwtLocaleText } from './JwtTool.types';
import styles from './JwtTool.module.css';

export function JwtDecodePanel({ mt, onCopy }: { mt: JwtLocaleText; onCopy: JwtCopyHandler }) {
  const [token, setToken] = useState('');
  const decoded = useMemo(() => {
    const result = decodeJwt(token);
    if (!result) return null;
    if ('error' in result) return { error: mt('decodeError') };
    return result;
  }, [mt, token]);

  return (
    <ToolSection title={mt('tabDecode')} icon={<VscSearch />} accentColor="#8e44ad">
      <ToolTextarea
        mono
        value={token}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setToken(event.target.value)}
        placeholder={mt('inputPlaceholder')}
        spellCheck={false}
        rows={3}
      />
      {decoded && 'error' in decoded && <div className={styles.err}>{decoded.error}</div>}
      {decoded && 'header' in decoded && (
        <div className={styles.grid}>
          <JsonBlock
            title={mt('header')}
            value={decoded.header}
            copyLabel={mt('copy')}
            onCopy={() => onCopy(decoded.header)}
          />
          <JsonBlock
            title={mt('payload')}
            value={decoded.payload}
            copyLabel={mt('copy')}
            onCopy={() => onCopy(decoded.payload)}
          />
        </div>
      )}
      {decoded && 'signature' in decoded && (
        <Block title={mt('signature')} copyLabel={mt('copy')} onCopy={() => onCopy(decoded.signature)}>
          <code className={styles.sig}>{decoded.signature}</code>
        </Block>
      )}
    </ToolSection>
  );
}
