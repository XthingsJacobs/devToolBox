import type { FileFilter, GenerateClientCertParams } from '@devtoolbox/core';
import type {
  ClientCertFormState,
  ClientCertOutputs,
  OutputTab,
  SaveTarget,
  TabId,
  ValidityOption,
} from './ClientCertGenerator.types';

export const KEY_SIZES = [2048, 3072, 4096];
export const VALIDITY_KEYS: ValidityOption[] = [
  { labelKey: 'year1', days: 365 },
  { labelKey: 'year2', days: 730 },
  { labelKey: 'year5', days: 1825 },
  { labelKey: 'year10', days: 3650 },
];

export function hasCsrInput(value: string): boolean {
  return value.trim().length > 0;
}

export function normalizeCountry(value: string): string {
  return value.toUpperCase().slice(0, 2);
}

export function buildPemFileFilters(labels: { pemFiles: string; allFiles: string }): FileFilter[] {
  return [
    { name: labels.pemFiles, extensions: ['pem', 'crt', 'key', 'cer', 'csr'] },
    { name: labels.allFiles, extensions: ['*'] },
  ];
}

export function validateGenerationInput(input: Pick<ClientCertFormState, 'caCert' | 'caKey'>): string | null {
  if (!input.caCert.trim()) return 'errNoCACert';
  if (!input.caKey.trim()) return 'errNoCAKey';
  return null;
}

function optionalTrim(value: string): string | undefined {
  return value.trim() || undefined;
}

export function buildGenerateClientCertParams(input: ClientCertFormState): GenerateClientCertParams {
  return {
    caCertPem: input.caCert.trim(),
    caKeyPem: input.caKey.trim(),
    csrPem: optionalTrim(input.csrInput),
    commonName: optionalTrim(input.commonName),
    organization: optionalTrim(input.organization),
    organizationalUnit: optionalTrim(input.organizationalUnit),
    country: optionalTrim(input.country),
    state: optionalTrim(input.state),
    locality: optionalTrim(input.locality),
    keySize: input.keySize,
    validityDays: input.validityDays,
  };
}

export function buildOutputTabs(hasCSR: boolean): OutputTab[] {
  return hasCSR
    ? [{ id: 'cert', labelKey: 'tabCert' }]
    : [
        { id: 'cert', labelKey: 'tabCert' },
        { id: 'key', labelKey: 'tabKey' },
        { id: 'csr', labelKey: 'CSR', literalLabel: 'CSR' },
      ];
}

export function selectOutput(outputs: ClientCertOutputs, activeTab: TabId): string {
  const outputMap: Record<TabId, string> = {
    cert: outputs.clientCert,
    key: outputs.clientKey,
    csr: outputs.generatedCsr,
    csrKey: outputs.clientKey,
  };
  return outputMap[activeTab] ?? '';
}

export function buildSaveTarget(activeTab: TabId, commonName: string): SaveTarget {
  const baseName = commonName || 'client';
  const extMap: Record<TabId, SaveTarget> = {
    cert: { ext: 'crt', name: `${baseName}.crt` },
    key: { ext: 'key', name: `${baseName}.key` },
    csr: { ext: 'csr', name: `${baseName}.csr` },
    csrKey: { ext: 'key', name: `${baseName}-csr.key` },
  };
  return extMap[activeTab];
}
