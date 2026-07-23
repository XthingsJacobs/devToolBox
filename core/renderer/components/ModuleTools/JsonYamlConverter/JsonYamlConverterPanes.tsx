import type { ChangeEvent, RefObject } from 'react';
import { VscFolderOpened, VscWand } from 'react-icons/vsc';
import ResponsiveActions from '../../ResponsiveActions';
import SafeHtml from '../../SafeHtml';
import type { JsonYamlMode, LocaleText, TextStats } from './JsonYamlConverter.types';
import styles from './JsonYamlConverter.module.css';

function StatsBar({ stats }: { stats: TextStats }) {
  return (
    <div className={styles.statusBar}>
      <span>Length: {stats.length}</span>
      <span>Spaces: {stats.spaces}</span>
      <span>Lines: {stats.lines}</span>
    </div>
  );
}

export function JsonYamlInputPane({
  widthPercent,
  mode,
  inputTitle,
  importLabel,
  acceptAttr,
  yamlInput,
  highlightedYamlInput,
  inputStats,
  editorHostRef,
  fileInputRef,
  yamlTextareaRef,
  yamlHighlightRef,
  onModeChange,
  onImport,
  onFormat,
  onClear,
  onFileSelect,
  onYamlInputChange,
  onYamlScroll,
  mt,
}: {
  widthPercent: number;
  mode: JsonYamlMode;
  inputTitle: string;
  importLabel: string;
  acceptAttr: string;
  yamlInput: string;
  highlightedYamlInput: string;
  inputStats: TextStats;
  editorHostRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  yamlTextareaRef: RefObject<HTMLTextAreaElement | null>;
  yamlHighlightRef: RefObject<HTMLPreElement | null>;
  onModeChange: (mode: JsonYamlMode) => void;
  onImport: () => void;
  onFormat: () => void;
  onClear: () => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onYamlInputChange: (value: string) => void;
  onYamlScroll: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.inputPane} style={{ width: `${widthPercent}%` }}>
      <div className={styles.paneHeader}>
        <div className={styles.modeWrap}>
          <span className={styles.modeLabel}>{mt('mode')}</span>
          <select
            className={styles.modeSelect}
            value={mode}
            onChange={(event) => onModeChange(event.target.value as JsonYamlMode)}
          >
            <option value="jsonToYaml">{mt('modeJsonToYaml')}</option>
            <option value="yamlToJson">{mt('modeYamlToJson')}</option>
          </select>
          <span className={styles.paneTitle}>{inputTitle}</span>
        </div>
        <ResponsiveActions
          actions={[
            { label: importLabel, onClick: onImport, icon: <VscFolderOpened /> },
            ...(mode === 'jsonToYaml'
              ? [{ label: mt('formatJson'), onClick: onFormat, icon: <VscWand /> }]
              : []),
            { label: mt('clear'), onClick: onClear },
          ]}
          compactWidth={420}
        />
      </div>
      <div className={styles.body}>
        {mode === 'jsonToYaml' ? (
          <div key="json" ref={editorHostRef as RefObject<HTMLDivElement>} className={styles.editor} />
        ) : (
          <div key="yaml" className={styles.yamlWrap}>
            <pre
              ref={yamlHighlightRef as RefObject<HTMLPreElement>}
              className={styles.yamlHighlight}
              aria-hidden
            >
              <SafeHtml as="code" html={highlightedYamlInput || ' '} profile="syntax" />
            </pre>
            <textarea
              ref={yamlTextareaRef as RefObject<HTMLTextAreaElement>}
              className={styles.yamlTextarea}
              value={yamlInput}
              placeholder={mt('placeholderYaml')}
              onChange={(event) => onYamlInputChange(event.target.value)}
              onScroll={onYamlScroll}
              spellCheck={false}
            />
          </div>
        )}
        <input
          ref={fileInputRef as RefObject<HTMLInputElement>}
          type="file"
          accept={acceptAttr}
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
      </div>
      <StatsBar stats={inputStats} />
    </div>
  );
}

export function JsonYamlOutputPane({
  widthPercent,
  outputTitle,
  outputText,
  outputStats,
  highlightedOutput,
  placeholder,
  copied,
  error,
  onCopy,
  onDownload,
  mt,
}: {
  widthPercent: number;
  outputTitle: string;
  outputText: string;
  outputStats: TextStats;
  highlightedOutput: string;
  placeholder: string;
  copied: boolean;
  error: string;
  onCopy: () => void;
  onDownload: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.outputPane} style={{ width: `${widthPercent}%` }}>
      <div className={styles.paneHeader}>
        <span className={styles.paneTitle}>{outputTitle}</span>
        <ResponsiveActions
          actions={[
            { label: copied ? mt('copied') : mt('copy'), onClick: onCopy, disabled: !outputText },
            { label: mt('save'), onClick: onDownload, disabled: !outputText },
          ]}
          compactWidth={420}
        />
      </div>
      <div className={styles.body}>
        <div className={styles.outputWrap}>
          {outputText ? (
            <pre className={styles.outputPre}>
              <SafeHtml as="code" html={highlightedOutput} profile="syntax" />
            </pre>
          ) : (
            <pre className={styles.outputPre}>{placeholder}</pre>
          )}
        </div>
      </div>
      <StatsBar stats={outputStats} />
      {error ? <div className={styles.errorBar}>{error}</div> : null}
    </div>
  );
}
