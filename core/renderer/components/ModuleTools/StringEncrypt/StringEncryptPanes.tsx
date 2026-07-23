import type { ChangeEvent } from 'react';
import type {
  AesMode,
  AesResult,
  EncodedResult,
  HashResult,
  HmacResult,
  LocaleText,
} from './StringEncrypt.types';
import styles from './StringEncrypt.module.css';

function ResultRow({
  label,
  value,
  onCopy,
  mt,
}: {
  label: string;
  value: string;
  onCopy: (value: string) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.algName}>{label}</span>
      <span className={styles.value}>{value || '-'}</span>
      {value && (
        <button className={styles.cpBtn} onClick={() => onCopy(value)}>
          {mt('copy')}
        </button>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead} onClick={() => onToggle(id)}>
        <span className={`${styles.sectionArrow} ${!collapsed ? styles.sectionArrowOpen : ''}`}>▶</span>
        {title}
      </div>
      {!collapsed && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

export function StringEncryptView({
  input,
  hmacKey,
  aesKey,
  aesIv,
  aesMode,
  hashes,
  hmacs,
  encodings,
  aesResult,
  collapsed,
  onInputChange,
  onHmacKeyChange,
  onAesKeyChange,
  onAesIvChange,
  onAesModeChange,
  onToggle,
  onCopy,
  mt,
}: {
  input: string;
  hmacKey: string;
  aesKey: string;
  aesIv: string;
  aesMode: AesMode;
  hashes: HashResult[];
  hmacs: HmacResult[];
  encodings: EncodedResult[];
  aesResult: AesResult | null;
  collapsed: Record<string, boolean>;
  onInputChange: (value: string) => void;
  onHmacKeyChange: (value: string) => void;
  onAesKeyChange: (value: string) => void;
  onAesIvChange: (value: string) => void;
  onAesModeChange: (value: AesMode) => void;
  onToggle: (id: string) => void;
  onCopy: (value: string) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.wrap}>
      <textarea
        className={styles.inputArea}
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder={mt('inputPlaceholder')}
        rows={3}
        spellCheck={false}
      />
      <div className={styles.results}>
        <Section id="hash" title={mt('hashTitle')} collapsed={Boolean(collapsed.hash)} onToggle={onToggle}>
          {!input ? (
            <div className={styles.empty}>{mt('inputPlaceholder')}</div>
          ) : (
            hashes.map((hash) => (
              <ResultRow key={hash.alg} label={hash.label} value={hash.value} onCopy={onCopy} mt={mt} />
            ))
          )}
        </Section>

        <Section
          id="encode"
          title={mt('encodeTitle')}
          collapsed={Boolean(collapsed.encode)}
          onToggle={onToggle}
        >
          {!input ? (
            <div className={styles.empty}>{mt('inputPlaceholder')}</div>
          ) : (
            encodings.map((encoding) => (
              <ResultRow
                key={encoding.label}
                label={encoding.label}
                value={encoding.value}
                onCopy={onCopy}
                mt={mt}
              />
            ))
          )}
        </Section>

        <Section id="hmac" title={mt('hmacTitle')} collapsed={Boolean(collapsed.hmac)} onToggle={onToggle}>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>{mt('hmacKey')}</span>
            <input
              className={styles.paramInput}
              value={hmacKey}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onHmacKeyChange(event.target.value)}
              placeholder={mt('hmacKeyPlaceholder')}
            />
          </div>
          {!input || !hmacKey ? (
            <div className={styles.empty}>{mt('hmacKeyPlaceholder')}</div>
          ) : (
            hmacs.map((hmac) => (
              <ResultRow key={hmac.alg} label={hmac.label} value={hmac.value} onCopy={onCopy} mt={mt} />
            ))
          )}
        </Section>

        <Section id="aes" title={mt('aesTitle')} collapsed={Boolean(collapsed.aes)} onToggle={onToggle}>
          <div className={styles.paramRow}>
            <span className={styles.paramLabel}>{mt('aesKey')}</span>
            <input
              className={styles.paramInput}
              value={aesKey}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onAesKeyChange(event.target.value)}
              placeholder={mt('aesKeyPlaceholder')}
            />
            <select
              className={styles.paramSelect}
              value={aesMode}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                onAesModeChange(event.target.value as AesMode)
              }
            >
              <option value="CBC">AES-CBC</option>
              <option value="GCM">AES-GCM</option>
            </select>
          </div>
          {aesMode === 'CBC' && (
            <div className={styles.paramRow}>
              <span className={styles.paramLabel}>{mt('aesIv')}</span>
              <input
                className={styles.paramInput}
                value={aesIv}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onAesIvChange(event.target.value)}
                placeholder={mt('aesIvPlaceholder')}
              />
            </div>
          )}
          {aesResult?.error && <div className={styles.err}>{aesResult.error}</div>}
          {aesResult && !aesResult.error && (
            <>
              <ResultRow label="Encrypted" value={aesResult.result} onCopy={onCopy} mt={mt} />
              <ResultRow label="IV" value={aesResult.iv} onCopy={onCopy} mt={mt} />
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
