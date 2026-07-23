import type {
  CertInfo,
  CertificateSubjectParams,
  CryptoResult,
  GenerateCaParams,
  GenerateClientCertParams,
} from '@devtoolbox/core';
import { getElectronApi } from '../lib/electron';

export const cryptoService = {
  generateCSR(
    params: CertificateSubjectParams,
  ): Promise<CryptoResult<{ privateKey: string; csr: string }>> | undefined {
    return getElectronApi()?.generateCSR(params);
  },

  generateCA(
    params: GenerateCaParams,
  ): Promise<CryptoResult<{ privateKey: string; certificate: string }>> | undefined {
    return getElectronApi()?.generateCA(params);
  },

  generateRSAKeyPair(params: {
    keySize: number;
  }): Promise<CryptoResult<{ publicKey: string; privateKey: string }>> | undefined {
    return getElectronApi()?.generateRSAKeyPair(params);
  },

  generateClientCert(
    params: GenerateClientCertParams,
  ): Promise<CryptoResult<{ privateKey?: string; certificate: string; csr?: string }>> | undefined {
    return getElectronApi()?.generateClientCert(params);
  },

  parseCert(certPem: string): Promise<CryptoResult<{ info: CertInfo }>> | undefined {
    return getElectronApi()?.parseCert(certPem);
  },
};
