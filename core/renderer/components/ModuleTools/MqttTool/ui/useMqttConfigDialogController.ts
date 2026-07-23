import { useCallback, useState } from 'react';
import type { MqttConfig } from '../mqttTypes';
import { getDefaultMqttConfig } from '../mqttTypes';
import { openFileBase64 } from '../sdk';
import { t } from './i18n';
import {
  applyCertFileSelection,
  createMqttClientId,
  MQTT_CERT_FILE_FILTERS,
  MQTT_CONFIG_SECTIONS,
  validateMqttConfig,
  type MqttCertFileField,
  type MqttConfigSection,
} from './MqttConfigDialog.model';

export type MqttConfigFieldSetter = <K extends keyof MqttConfig>(key: K, value: MqttConfig[K]) => void;

export function useMqttConfigDialogController({
  config,
  onSave,
}: {
  config?: MqttConfig;
  onSave: (config: MqttConfig) => void;
}) {
  const [form, setForm] = useState<MqttConfig>(config ?? getDefaultMqttConfig());
  const [error, setError] = useState('');
  const [openSections, setOpenSections] = useState(MQTT_CONFIG_SECTIONS);

  const setField = useCallback<MqttConfigFieldSetter>(
    (key, value) => setForm((previous) => ({ ...previous, [key]: value })),
    [],
  );

  const toggleSection = useCallback((section: MqttConfigSection) => {
    setOpenSections((previous) => ({ ...previous, [section]: !previous[section] }));
  }, []);

  const handleSave = useCallback(() => {
    const errorKey = validateMqttConfig(form);
    if (errorKey) {
      setError(t(errorKey));
      return;
    }
    onSave(form);
  }, [form, onSave]);

  const regenClientId = useCallback(() => {
    setField('clientId', createMqttClientId());
  }, [setField]);

  const handleFileSelect = useCallback(async (field: MqttCertFileField) => {
    const selected = await openFileBase64(MQTT_CERT_FILE_FILTERS);
    if (!selected) return;
    setForm((previous) => applyCertFileSelection(previous, field, selected));
  }, []);

  const handleCertTypeChange = useCallback(
    (value: MqttConfig['certType']) => {
      setField('certType', value);
      if (value === 'self-signed') setOpenSections((previous) => ({ ...previous, certs: true }));
    },
    [setField],
  );

  return {
    form,
    error,
    openSections,
    setField,
    toggleSection,
    handleSave,
    regenClientId,
    handleFileSelect,
    handleCertTypeChange,
  };
}
