import { useCallback, useMemo, useState } from 'react';
import {
  buildGenerateClientCertParams,
  buildOutputTabs,
  buildPemFileFilters,
  buildSaveTarget,
  hasCsrInput,
  normalizeCountry,
  selectOutput,
  validateGenerationInput,
} from './ClientCertGenerator.model';
import type {
  ClientCertBridge,
  ClientCertFormState,
  ClientCertOutputs,
  LocaleText,
  TabId,
} from './ClientCertGenerator.types';

export function useClientCertGeneratorController({
  mt,
  bridge,
}: {
  mt: LocaleText;
  bridge: ClientCertBridge;
}) {
  const [form, setForm] = useState<ClientCertFormState>({
    caCert: '',
    caKey: '',
    csrInput: '',
    commonName: '',
    organization: '',
    organizationalUnit: '',
    country: '',
    state: '',
    locality: '',
    keySize: 2048,
    validityDays: 365,
  });
  const [outputs, setOutputs] = useState<ClientCertOutputs>({
    clientCert: '',
    clientKey: '',
    generatedCsr: '',
  });
  const [activeTab, setActiveTab] = useState<TabId>('cert');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const hasCSR = hasCsrInput(form.csrInput);
  const tabs = useMemo(() => buildOutputTabs(hasCSR), [hasCSR]);
  const currentOutput = useMemo(() => selectOutput(outputs, activeTab), [activeTab, outputs]);

  const setField = useCallback(
    <TKey extends keyof ClientCertFormState>(key: TKey, value: ClientCertFormState[TKey]) => {
      setForm((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const loadFile = useCallback(
    async (key: 'caCert' | 'caKey' | 'csrInput') => {
      const result = await bridge.openPemFile(
        buildPemFileFilters({ pemFiles: mt('pemFiles'), allFiles: mt('allFiles') }),
      );
      if (result?.content) setField(key, result.content);
    },
    [bridge, mt, setField],
  );

  const handleGenerate = useCallback(async () => {
    const errorKey = validateGenerationInput(form);
    if (errorKey) {
      setError(mt(errorKey));
      return;
    }

    setGenerating(true);
    setError('');
    try {
      const result = await bridge.generateClientCert(buildGenerateClientCertParams(form));
      if (result?.success) {
        setOutputs({
          clientCert: result.certificate ?? '',
          clientKey: result.privateKey ?? '',
          generatedCsr: result.csr ?? '',
        });
        setActiveTab('cert');
      } else {
        setError(result?.error ?? mt('generateFailed'));
      }
    } catch {
      setError(mt('generateFailed'));
    } finally {
      setGenerating(false);
    }
  }, [bridge, form, mt]);

  const handleCopy = useCallback(() => {
    if (currentOutput) void navigator.clipboard.writeText(currentOutput);
  }, [currentOutput]);

  const handleSave = useCallback(async () => {
    if (!currentOutput) return;
    const { ext, name } = buildSaveTarget(activeTab, form.commonName);
    await bridge.saveFileAs(name, currentOutput, [
      { name: `${ext.toUpperCase()} ${mt('fileLabel')}`, extensions: [ext, 'pem'] },
    ]);
  }, [activeTab, bridge, currentOutput, form.commonName, mt]);

  return {
    formPaneProps: {
      form,
      hasCSR,
      error,
      generating,
      onFieldChange: setField,
      onCountryChange: (value: string) => setField('country', normalizeCountry(value)),
      onLoadFile: (key: 'caCert' | 'caKey' | 'csrInput') => void loadFile(key),
      onGenerate: () => void handleGenerate(),
    },
    outputPaneProps: {
      tabs,
      activeTab,
      currentOutput,
      onActiveTabChange: setActiveTab,
      onCopy: handleCopy,
      onSave: () => void handleSave(),
    },
  };
}
