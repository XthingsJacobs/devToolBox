import { ipcMain } from 'electron';
import {
  buildSubjectDN,
  sigAlgDER,
  derInteger,
  derSequence,
  derBitString,
  derContextTag,
} from '../../../../main/ipc/crypto-utils';
import * as crypto from 'node:crypto';

export function register(): void {
  ipcMain.handle(
    'crypto:generateCSR',
    (
      _event,
      params: {
        commonName?: string;
        organization?: string;
        organizationalUnit?: string;
        country?: string;
        state?: string;
        locality?: string;
        keySize: number;
      },
    ) => {
      try {
        const { commonName, organization, organizationalUnit, country, state, locality, keySize } = params;

        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: keySize,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        const subjectDN = buildSubjectDN({
          commonName,
          organization,
          organizationalUnit,
          country,
          state,
          locality,
        });
        const pubPem = publicKey.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
        const pubDer = Buffer.from(pubPem, 'base64');

        const version = derInteger(0);
        const attributes = derContextTag(0, Buffer.alloc(0));
        const certReqInfo = derSequence(Buffer.concat([version, subjectDN, pubDer, attributes]));

        const signer = crypto.createSign('SHA256');
        signer.update(certReqInfo);
        const signature = signer.sign(privateKey);

        const csr = derSequence(Buffer.concat([certReqInfo, sigAlgDER(), derBitString(signature)]));
        const lines = csr.toString('base64').match(/.{1,64}/g);
        const csrPem =
          '-----BEGIN CERTIFICATE REQUEST-----\n' +
          (lines ? lines.join('\n') : csr.toString('base64')) +
          '\n-----END CERTIFICATE REQUEST-----\n';

        return { success: true, privateKey, csr: csrPem };
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        return { success: false, error };
      }
    },
  );
}
