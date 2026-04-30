import { ipcMain } from 'electron';
import {
  encodeDERLength,
  derSequence,
  derOID,
  derInteger,
  derBitString,
  derOctetString,
  derBoolean,
  derContextTag,
  derUTCTime,
  buildSubjectDN,
  sigAlgDER,
  BASIC_CONSTRAINTS_OID,
  KEY_USAGE_OID,
  SUBJECT_KEY_IDENTIFIER_OID,
} from '../../../../main/ipc/crypto-utils';
import * as crypto from 'node:crypto';

export function register(): void {
  ipcMain.handle(
    'crypto:generateCA',
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
        validityDays: number;
      },
    ) => {
      try {
        const {
          commonName,
          organization,
          organizationalUnit,
          country,
          state: st,
          locality,
          keySize,
          validityDays,
        } = params;

        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: keySize,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        const issuerSubject = buildSubjectDN({
          commonName,
          organization,
          organizationalUnit,
          country,
          state: st,
          locality,
        });
        const serial = crypto.randomBytes(16);
        serial[0] &= 0x7f;

        const notBefore = new Date();
        const notAfter = new Date(notBefore.getTime() + validityDays * 86400000);
        const validity = derSequence(Buffer.concat([derUTCTime(notBefore), derUTCTime(notAfter)]));

        const pubPem = publicKey.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
        const pubDer = Buffer.from(pubPem, 'base64');

        const basicConstraints = derSequence(
          Buffer.concat([
            derOID(BASIC_CONSTRAINTS_OID),
            derBoolean(true),
            derOctetString(derSequence(derBoolean(true))),
          ]),
        );
        const keyUsageBits = Buffer.from([0x05, 0x06]);
        const keyUsage = derSequence(
          Buffer.concat([
            derOID(KEY_USAGE_OID),
            derBoolean(true),
            derOctetString(
              Buffer.concat([Buffer.from([0x03]), encodeDERLength(keyUsageBits.length), keyUsageBits]),
            ),
          ]),
        );
        const pubKeyHash = crypto.createHash('sha1').update(pubDer).digest();
        const ski = derSequence(
          Buffer.concat([derOID(SUBJECT_KEY_IDENTIFIER_OID), derOctetString(derOctetString(pubKeyHash))]),
        );
        const extensions = derContextTag(3, derSequence(Buffer.concat([basicConstraints, keyUsage, ski])));

        const version = derContextTag(0, derInteger(2));
        const tbsCert = derSequence(
          Buffer.concat([
            version,
            derInteger(serial),
            sigAlgDER(),
            issuerSubject,
            validity,
            issuerSubject,
            pubDer,
            extensions,
          ]),
        );

        const signer = crypto.createSign('SHA256');
        signer.update(tbsCert);
        const signature = signer.sign(privateKey);

        const cert = derSequence(Buffer.concat([tbsCert, sigAlgDER(), derBitString(signature)]));
        const lines = cert.toString('base64').match(/.{1,64}/g);
        const certPem =
          '-----BEGIN CERTIFICATE-----\n' +
          (lines ? lines.join('\n') : cert.toString('base64')) +
          '\n-----END CERTIFICATE-----\n';

        return { success: true, privateKey, certificate: certPem };
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        return { success: false, error };
      }
    },
  );
}
