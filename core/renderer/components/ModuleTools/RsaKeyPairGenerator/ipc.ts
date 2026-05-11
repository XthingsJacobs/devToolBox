import { ipcMain } from 'electron';
import * as crypto from 'node:crypto';

export function register(): void {
  ipcMain.handle('crypto:generateRSAKeyPair', (_event, params: { keySize: number }) => {
    try {
      const keySize = Number(params?.keySize ?? 2048);
      if (!Number.isFinite(keySize) || keySize < 1024 || keySize > 8192) {
        return { success: false, error: 'Invalid key size' };
      }

      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      return { success: true, publicKey, privateKey };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return { success: false, error };
    }
  });
}
