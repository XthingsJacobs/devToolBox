import type { CryptoResult, FileFilter, GenerateClientCertParams, OpenFileResult } from '@devtoolbox/core';

export type TabId = 'cert' | 'key' | 'csr' | 'csrKey';
export type LocaleText = (key: string) => string;

export interface ValidityOption {
  labelKey: string;
  days: number;
}

export interface ClientCertFormState {
  caCert: string;
  caKey: string;
  csrInput: string;
  commonName: string;
  organization: string;
  organizationalUnit: string;
  country: string;
  state: string;
  locality: string;
  keySize: number;
  validityDays: number;
}

export interface ClientCertOutputs {
  clientCert: string;
  clientKey: string;
  generatedCsr: string;
}

export type ClientCertFieldChange = <TKey extends keyof ClientCertFormState>(
  key: TKey,
  value: ClientCertFormState[TKey],
) => void;

export interface OutputTab {
  id: TabId;
  labelKey: string;
  literalLabel?: string;
}

export interface SaveTarget {
  ext: string;
  name: string;
}

export type GenerateClientCertResult = CryptoResult<{
  privateKey?: string;
  certificate: string;
  csr?: string;
}>;

export interface ClientCertBridge {
  openPemFile: (filters: FileFilter[]) => Promise<OpenFileResult | null> | undefined;
  generateClientCert: (params: GenerateClientCertParams) => Promise<GenerateClientCertResult> | undefined;
  saveFileAs: (
    defaultName: string,
    content: string,
    filters?: FileFilter[],
  ) => Promise<string | null> | undefined;
}
