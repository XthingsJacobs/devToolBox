import type { ChangeEvent, RefObject } from 'react';
import { VscFolderOpened, VscWand } from 'react-icons/vsc';
import ResponsiveActions from '../../ResponsiveActions';
import SafeHtml from '../../SafeHtml';
import type { JsonXmlMode, LocaleText, TextStats } from './JsonXmlConverter.types';
import styles from './JsonXmlConverter.module.css';

function StatsBar({ stats }: { stats: TextStats }) {
  return (
    <div className={styles.statusBar}>
      <span>Length: {stats.length}</span>
      <span>Spaces: {stats.spaces}</span>
      <span>Lines: {stats.lines}</span>
    </div>
  );
}

export function JsonXmlInputPane({
  widthPercent,
  mode,
  inputTitle,
  importLabel,
  acceptAttr,
  xmlInput,
  highlightedXmlInput,
  inputStats,
  editorHostRef,
  fileInputRef,
  xmlTextareaRef,
  xmlHighlightRef,
  onModeChange,
  onImport,
  onFormat,
  onClear,
  onFileSelect,
  onXmlInputChange,
  onXmlScroll,
  mt,
}: {
  widthPercent: number;
  mode: JsonXmlMode;
  inputTitle: string;
  importLabel: string;
  acceptAttr: string;
  xmlInput: string;
  highlightedXmlInput: string;
  inputStats: TextStats;
  editorHostRef: RefObject<HTMLDivElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  xmlTextareaRef: RefObject<HTMLTextAreaElement | null>;
  xmlHighlightRef: RefObject<HTMLPreElement | null>;
  onModeChange: (mode: JsonXmlMode) => void;
  onImport: () => void;
  onFormat: () => void;
  onClear: () => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onXmlInputChange: (value: string) => void;
  onXmlScroll: () => void;
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
            onChange={(event) => onModeChange(event.target.value as JsonXmlMode)}
          >
            <option value="jsonToXml">{mt('modeJsonToXml')}</option>
            <option value="xmlToJson">{mt('modeXmlToJson')}</option>
          </select>
          <span className={styles.paneTitle}>{inputTitle}</span>
        </div>
        <ResponsiveActions
          actions={[
            { label: importLabel, onClick: onImport, icon: <VscFolderOpened /> },
            ...(mode === 'jsonToXml'
              ? [{ label: mt('formatJson'), onClick: onFormat, icon: <VscWand /> }]
              : []),
            { label: mt('clear'), onClick: onClear },
          ]}
          compactWidth={420}
        />
      </div>
      <div className={styles.body}>
        {mode === 'jsonToXml' ? (
          <div key="json" ref={editorHostRef as RefObject<HTMLDivElement>} className={styles.editor} />
        ) : (
          <div key="xml" className={styles.xmlWrap}>
            <pre
              ref={xmlHighlightRef as RefObject<HTMLPreElement>}
              className={styles.xmlHighlight}
              aria-hidden
            >
              <SafeHtml as="code" html={highlightedXmlInput || ' '} profile="syntax" />
            </pre>
            <textarea
              ref={xmlTextareaRef as RefObject<HTMLTextAreaElement>}
              className={styles.xmlTextarea}
              value={xmlInput}
              placeholder={mt('placeholderXml')}
              onChange={(event) => onXmlInputChange(event.target.value)}
              onScroll={onXmlScroll}
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

export function JsonXmlOutputPane({
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
