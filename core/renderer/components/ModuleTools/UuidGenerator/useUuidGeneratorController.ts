import { useCallback, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import {
  clampQuantity,
  isNameBasedVersion,
  makeV1State,
  NS_PRESETS,
  parseUuid,
  uuidNameBased,
  uuidNil,
  uuidV1,
  uuidV4,
} from './UuidGenerator.model';
import type { LocaleText, NamespacePreset, SaveTextFile, UuidVersion, V1State } from './UuidGenerator.types';
import helpEn from './i18n/help-en.md?raw';
import helpZhCN from './i18n/help-zh-CN.md?raw';

export function useUuidGeneratorController({
  locale,
  mt,
  saveTextFile,
}: {
  locale: 'en' | 'zh-CN';
  mt: LocaleText;
  saveTextFile: SaveTextFile;
}) {
  const [version, setVersion] = useState<UuidVersion>('v4');
  const [quantity, setQuantity] = useState('1');
  const [namespacePreset, setNamespacePreset] = useState<NamespacePreset>('dns');
  const [namespaceUuid, setNamespaceUuid] = useState(NS_PRESETS.dns);
  const [name, setName] = useState('');
  const [outputList, setOutputList] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedAll, setSavedAll] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const v1StateRef = useRef<V1State | null>(null);

  const effectiveQuantity = useMemo(() => clampQuantity(quantity), [quantity]);
  const outputText = useMemo(() => outputList.join('\n'), [outputList]);
  const showNameBased = isNameBasedVersion(version);
  const helpHtml = useMemo(
    () => marked.parse(locale === 'zh-CN' ? helpZhCN : helpEn, { breaks: true, gfm: true }) as string,
    [locale],
  );

  const handleNamespacePresetChange = useCallback((next: NamespacePreset) => {
    setNamespacePreset(next);
    if (next !== 'custom') setNamespaceUuid(NS_PRESETS[next]);
  }, []);

  const handleGenerate = useCallback(async () => {
    setCopiedAll(false);
    setCopiedIndex(null);
    setError('');
    const list: string[] = [];

    if (version === 'nil') {
      for (let i = 0; i < effectiveQuantity; i += 1) list.push(uuidNil());
      setOutputList(list);
      return;
    }
    if (version === 'v4') {
      for (let i = 0; i < effectiveQuantity; i += 1) list.push(uuidV4());
      setOutputList(list);
      return;
    }
    if (version === 'v1') {
      if (!v1StateRef.current) v1StateRef.current = makeV1State();
      for (let i = 0; i < effectiveQuantity; i += 1) list.push(uuidV1(v1StateRef.current));
      setOutputList(list);
      return;
    }

    const namespaceBytes = parseUuid(namespaceUuid);
    if (!namespaceBytes) {
      setError(mt('errorInvalidNamespace'));
      return;
    }
    if (!name.trim()) {
      setError(mt('errorNameRequired'));
      return;
    }
    for (let i = 0; i < effectiveQuantity; i += 1) {
      list.push(await uuidNameBased(version === 'v3' ? 3 : 5, namespaceBytes, name));
    }
    setOutputList(list);
  }, [effectiveQuantity, mt, name, namespaceUuid, version]);

  const markSaved = useCallback(() => {
    setSavedAll(true);
    window.setTimeout(() => setSavedAll(false), 1500);
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!outputText) return;
    const savedPath = await saveTextFile('uuids.txt', outputText, [{ name: 'Text', extensions: ['txt'] }]);
    if (savedPath === null) return;
    if (savedPath !== undefined) {
      markSaved();
      return;
    }

    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'uuids.txt';
    anchor.click();
    URL.revokeObjectURL(url);
    markSaved();
  }, [markSaved, outputText, saveTextFile]);

  const handleCopyAll = useCallback(async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 1500);
  }, [outputText]);

  const handleCopyOne = useCallback(async (uuid: string, index: number) => {
    await navigator.clipboard.writeText(uuid);
    setCopiedIndex(index);
    window.setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 1500);
  }, []);

  return {
    configPaneProps: {
      version,
      quantity,
      namespacePreset,
      namespaceUuid,
      name,
      error,
      showNameBased,
      onVersionChange: setVersion,
      onQuantityChange: setQuantity,
      onNamespacePresetChange: handleNamespacePresetChange,
      onNamespaceUuidChange: setNamespaceUuid,
      onNameChange: setName,
      onGenerate: () => void handleGenerate(),
      onShowHelp: () => setShowHelp(true),
    },
    outputPaneProps: {
      outputList,
      copiedAll,
      savedAll,
      copiedIndex,
      onSaveAll: () => void handleSaveAll(),
      onCopyAll: () => void handleCopyAll(),
      onCopyOne: (uuid: string, index: number) => void handleCopyOne(uuid, index),
    },
    helpDialogProps: {
      show: showHelp,
      helpHtml,
      onClose: () => setShowHelp(false),
    },
  };
}
