import { ipcMain } from 'electron';
import * as crypto from 'node:crypto';

function parseDN(dn: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!dn) return result;
  for (const part of dn.split('\n')) {
    const idx = part.indexOf('=');
    if (idx > 0) result[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return result;
}

export function register(): void {
  ipcMain.handle('crypto:parseCert', (_event, certPem: string) => {
    try {
      const x509 = new crypto.X509Certificate(certPem);

      const extensions: { name: string; value: string }[] = [];
      if (x509.ca !== undefined)
        extensions.push({ name: 'Basic Constraints', value: x509.ca ? 'CA: TRUE' : 'CA: FALSE' });
      if (x509.keyUsage?.length > 0) extensions.push({ name: 'Key Usage', value: x509.keyUsage.join(', ') });
      if (x509.subjectAltName) extensions.push({ name: 'Subject Alt Name', value: x509.subjectAltName });

      let publicKeyInfo: Record<string, string> = {};
      try {
        const pk = x509.publicKey;
        const details = pk.asymmetricKeyDetails as
          | { modulusLength?: number; namedCurve?: string }
          | undefined;
        publicKeyInfo = {
          algorithm: (pk.asymmetricKeyType ?? 'unknown').toUpperCase(),
          size:
            typeof details?.modulusLength === 'number'
              ? `${details.modulusLength} bit`
              : typeof details?.namedCurve === 'string'
                ? details.namedCurve
                : 'N/A',
        };
      } catch {
        publicKeyInfo = { algorithm: 'Unknown', size: 'N/A' };
      }

      return {
        success: true,
        info: {
          subject: parseDN(x509.subject),
          issuer: parseDN(x509.issuer),
          serialNumber: x509.serialNumber ?? '',
          validFrom: x509.validFrom ?? '',
          validTo: x509.validTo ?? '',
          publicKey: publicKeyInfo,
          fingerprint256: x509.fingerprint256 ?? '',
          fingerprint: x509.fingerprint ?? '',
          extensions,
          isCA: x509.ca ?? false,
          raw: x509.toString(),
        },
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return { success: false, error };
    }
  });
}
