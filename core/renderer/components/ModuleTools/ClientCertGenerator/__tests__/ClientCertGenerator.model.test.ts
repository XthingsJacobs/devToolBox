import { describe, expect, it } from 'vitest';
import {
  buildGenerateClientCertParams,
  buildOutputTabs,
  buildPemFileFilters,
  buildSaveTarget,
  hasCsrInput,
  normalizeCountry,
  selectOutput,
  validateGenerationInput,
} from '../ClientCertGenerator.model';

const baseForm = {
  caCert: '  cert  ',
  caKey: '  key  ',
  csrInput: '  ',
  commonName: '  client.example.com  ',
  organization: '',
  organizationalUnit: '  Dev  ',
  country: 'cn',
  state: '',
  locality: '  Shenzhen  ',
  keySize: 2048,
  validityDays: 365,
};

describe('ClientCertGenerator model', () => {
  it('validates required CA inputs', () => {
    expect(validateGenerationInput({ caCert: '', caKey: 'key' })).toBe('errNoCACert');
    expect(validateGenerationInput({ caCert: 'cert', caKey: '' })).toBe('errNoCAKey');
    expect(validateGenerationInput({ caCert: 'cert', caKey: 'key' })).toBeNull();
  });

  it('normalizes CSR and country input state', () => {
    expect(hasCsrInput('  ')).toBe(false);
    expect(hasCsrInput('-----BEGIN CERTIFICATE REQUEST-----')).toBe(true);
    expect(normalizeCountry('cna')).toBe('CN');
  });

  it('builds file filters and output tabs', () => {
    expect(buildPemFileFilters({ pemFiles: 'PEM', allFiles: 'All' })).toEqual([
      { name: 'PEM', extensions: ['pem', 'crt', 'key', 'cer', 'csr'] },
      { name: 'All', extensions: ['*'] },
    ]);
    expect(buildOutputTabs(false).map((tab) => tab.id)).toEqual(['cert', 'key', 'csr']);
    expect(buildOutputTabs(true).map((tab) => tab.id)).toEqual(['cert']);
  });

  it('trims generation params and converts empty fields to undefined', () => {
    expect(buildGenerateClientCertParams(baseForm)).toMatchObject({
      caCertPem: 'cert',
      caKeyPem: 'key',
      csrPem: undefined,
      commonName: 'client.example.com',
      organization: undefined,
      organizationalUnit: 'Dev',
      country: 'cn',
      state: undefined,
      locality: 'Shenzhen',
      keySize: 2048,
      validityDays: 365,
    });
  });

  it('selects output and save targets by active tab', () => {
    const outputs = { clientCert: 'cert', clientKey: 'key', generatedCsr: 'csr' };

    expect(selectOutput(outputs, 'cert')).toBe('cert');
    expect(selectOutput(outputs, 'key')).toBe('key');
    expect(selectOutput(outputs, 'csr')).toBe('csr');
    expect(selectOutput(outputs, 'csrKey')).toBe('key');
    expect(buildSaveTarget('cert', 'device')).toEqual({ ext: 'crt', name: 'device.crt' });
    expect(buildSaveTarget('csrKey', '')).toEqual({ ext: 'key', name: 'client-csr.key' });
  });
});
