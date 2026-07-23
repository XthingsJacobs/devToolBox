import type { ChangeEvent } from 'react';
import { HelpModal, ToolButton, ToolField, ToolInput, ToolSelect } from '@@components';
import { VscCopy, VscQuestion, VscSave } from 'react-icons/vsc';
import SafeHtml from '../../SafeHtml';
import { NS_PRESETS, UUID_VERSIONS } from './UuidGenerator.model';
import type { LocaleText, NamespacePreset, UuidVersion } from './UuidGenerator.types';
import styles from './UuidGenerator.module.css';
import './UuidHelp.css';

export function UuidConfigPane({
  version,
  quantity,
  namespacePreset,
  namespaceUuid,
  name,
  error,
  showNameBased,
  onVersionChange,
  onQuantityChange,
  onNamespacePresetChange,
  onNamespaceUuidChange,
  onNameChange,
  onGenerate,
  onShowHelp,
  mt,
}: {
  version: UuidVersion;
  quantity: string;
  namespacePreset: NamespacePreset;
  namespaceUuid: string;
  name: string;
  error: string;
  showNameBased: boolean;
  onVersionChange: (version: UuidVersion) => void;
  onQuantityChange: (value: string) => void;
  onNamespacePresetChange: (preset: NamespacePreset) => void;
  onNamespaceUuidChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onGenerate: () => void;
  onShowHelp: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.configPane}>
      <div className={styles.paneHeader}>
        <span>{mt('config')}</span>
        <div className={styles.actionsRow}>
          <ToolButton variant="primary" onClick={onGenerate}>
            {mt('generate')}
          </ToolButton>
          <ToolButton onClick={onShowHelp} aria-label={mt('help')}>
            <VscQuestion />
            {mt('help')}
          </ToolButton>
        </div>
      </div>

      <div className={styles.configBody}>
        <ToolField label={mt('version')}>
          <div className={styles.versionRow}>
            {UUID_VERSIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.verBtn}${version === item ? ` ${styles.verBtnActive}` : ''}`}
                onClick={() => onVersionChange(item)}
              >
                {item === 'nil' ? 'NIL' : item}
              </button>
            ))}
          </div>
        </ToolField>

        <div className={styles.row}>
          <ToolField label={mt('quantity')}>
            <ToolInput
              value={quantity}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onQuantityChange(event.target.value)}
              spellCheck={false}
              inputMode="numeric"
            />
          </ToolField>
        </div>

        {showNameBased && (
          <>
            <div className={styles.row}>
              <ToolField label={mt('namespace')}>
                <ToolSelect
                  value={namespacePreset}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    onNamespacePresetChange(event.target.value as NamespacePreset)
                  }
                >
                  <option value="dns">DNS</option>
                  <option value="url">URL</option>
                  <option value="oid">OID</option>
                  <option value="x500">X.500</option>
                  <option value="custom">Custom</option>
                </ToolSelect>
              </ToolField>

              <ToolField label={mt('nameInput')}>
                <ToolInput
                  value={name}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onNameChange(event.target.value)}
                  spellCheck={false}
                />
              </ToolField>
            </div>

            <ToolField label={mt('namespaceUuid')}>
              <ToolInput
                value={namespaceUuid}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onNamespaceUuidChange(event.target.value)}
                spellCheck={false}
                placeholder={NS_PRESETS.dns}
              />
            </ToolField>
          </>
        )}

        {error && <div className={styles.err}>{error}</div>}
      </div>
    </div>
  );
}

export function UuidOutputPane({
  outputList,
  copiedAll,
  savedAll,
  copiedIndex,
  onSaveAll,
  onCopyAll,
  onCopyOne,
  mt,
}: {
  outputList: string[];
  copiedAll: boolean;
  savedAll: boolean;
  copiedIndex: number | null;
  onSaveAll: () => void;
  onCopyAll: () => void;
  onCopyOne: (uuid: string, index: number) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.previewPane}>
      <div className={styles.paneHeader}>
        <span>{mt('output')}</span>
        <div className={styles.paneActions}>
          <ToolButton onClick={onSaveAll} disabled={!outputList.length}>
            <VscSave />
            {savedAll ? mt('saved') : mt('save')}
          </ToolButton>
          <ToolButton onClick={onCopyAll} disabled={!outputList.length}>
            <VscCopy />
            {copiedAll ? mt('copied') : mt('copy')}
          </ToolButton>
        </div>
      </div>

      <div className={styles.previewBody}>
        {outputList.length ? (
          <div className={styles.list}>
            {outputList.map((uuid, index) => (
              <div key={`${uuid}_${index}`} className={styles.item}>
                <span className={styles.itemIdx}>#{index + 1}</span>
                <code className={styles.itemCode}>{uuid}</code>
                <ToolButton
                  className={styles.itemBtn}
                  onClick={() => onCopyOne(uuid, index)}
                  aria-label={mt('copy')}
                >
                  <VscCopy />
                  {copiedIndex === index ? mt('copied') : mt('copy')}
                </ToolButton>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.placeholder}>{mt('placeholder')}</div>
        )}
      </div>
    </div>
  );
}

export function UuidHelpDialog({
  show,
  helpHtml,
  onClose,
  mt,
}: {
  show: boolean;
  helpHtml: string;
  onClose: () => void;
  mt: LocaleText;
}) {
  if (!show) return null;
  return (
    <HelpModal title={mt('helpTitle')} size="md" onClose={onClose}>
      <SafeHtml className="uuid-help" html={helpHtml} profile="rich-text" />
    </HelpModal>
  );
}
