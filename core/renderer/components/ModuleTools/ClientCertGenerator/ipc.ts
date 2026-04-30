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
  parseDERTag,
  skipDERElement,
  buildSubjectDN,
  sigAlgDER,
  BASIC_CONSTRAINTS_OID,
  KEY_USAGE_OID,
  EXT_KEY_USAGE_OID,
  CLIENT_AUTH_OID,
  SUBJECT_KEY_IDENTIFIER_OID,
} from '../../../../main/ipc/crypto-utils';
import * as crypto from 'node:crypto';

export function register(): void {
  ipcMain.handle(
    'crypto:generateClientCert',
    (
      _event,
      params: {
        caCertPem: string;
        caKeyPem: string;
        csrPem?: string;
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
          caCertPem,
          caKeyPem,
          csrPem,
          commonName,
          organization,
          organizationalUnit,
          country,
          state: st,
          locality,
          keySize,
          validityDays,
        } = params;

        try {
          crypto.createPrivateKey(caKeyPem);
        } catch {
          return { success: false, error: 'Invalid CA private key format' };
        }

        let clientPubDer: Buffer;
        let subjectDN: Buffer;
        let clientKeyPem: string | undefined;
        let generatedCsr: string | undefined;

        if (csrPem && csrPem.trim()) {
          const csrB64 = csrPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
          const csrDer = Buffer.from(csrB64, 'base64');
          const csrOuter = parseDERTag(csrDer, 0);
          const csrInfoTag = parseDERTag(csrDer, csrOuter.valueOffset);
          let csrInfoPos = csrInfoTag.valueOffset;
          csrInfoPos = skipDERElement(csrDer, csrInfoPos);
          const subjectTag = parseDERTag(csrDer, csrInfoPos);
          subjectDN = Buffer.from(csrDer.subarray(csrInfoPos, csrInfoPos + subjectTag.totalLength));
          csrInfoPos = skipDERElement(csrDer, csrInfoPos);
          const pubKeyTag = parseDERTag(csrDer, csrInfoPos);
          clientPubDer = Buffer.from(csrDer.subarray(csrInfoPos, csrInfoPos + pubKeyTag.totalLength));
        } else {
          const { privateKey: genKey, publicKey: genPub } = crypto.generateKeyPairSync('rsa', {
            modulusLength: keySize,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
          });
          clientKeyPem = genKey;
          const pubPem = genPub.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
          clientPubDer = Buffer.from(pubPem, 'base64');
          subjectDN = buildSubjectDN({
            commonName,
            organization,
            organizationalUnit,
            country,
            state: st,
            locality,
          });

          const csrVersion = derInteger(0);
          const csrAttributes = derContextTag(0, Buffer.alloc(0));
          const certReqInfo = derSequence(
            Buffer.concat([csrVersion, subjectDN, clientPubDer, csrAttributes]),
          );
          const csrSigner = crypto.createSign('SHA256');
          csrSigner.update(certReqInfo);
          const csrSig = csrSigner.sign(genKey);
          const csrDerBuf = derSequence(Buffer.concat([certReqInfo, sigAlgDER(), derBitString(csrSig)]));
          const csrLines = csrDerBuf.toString('base64').match(/.{1,64}/g);
          generatedCsr =
            '-----BEGIN CERTIFICATE REQUEST-----\n' +
            (csrLines ? csrLines.join('\n') : csrDerBuf.toString('base64')) +
            '\n-----END CERTIFICATE REQUEST-----\n';
        }

        const caCertB64 = caCertPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
        const caCertDer = Buffer.from(caCertB64, 'base64');
        let pos = 0;
        const outerSeq = parseDERTag(caCertDer, pos);
        pos = outerSeq.valueOffset;
        const tbsSeq = parseDERTag(caCertDer, pos);
        let tbsPos = tbsSeq.valueOffset;
        if (caCertDer[tbsPos] === 0xa0) tbsPos = skipDERElement(caCertDer, tbsPos);
        tbsPos = skipDERElement(caCertDer, tbsPos);
        tbsPos = skipDERElement(caCertDer, tbsPos);
        const issuerTag = parseDERTag(caCertDer, tbsPos);
        const issuerDN = caCertDer.subarray(tbsPos, tbsPos + issuerTag.totalLength);

        const serial = crypto.randomBytes(16);
        serial[0] &= 0x7f;
        const notBefore = new Date();
        const notAfter = new Date(notBefore.getTime() + validityDays * 86400000);
        const validity = derSequence(Buffer.concat([derUTCTime(notBefore), derUTCTime(notAfter)]));

        const basicConstraints = derSequence(
          Buffer.concat([
            derOID(BASIC_CONSTRAINTS_OID),
            derBoolean(true),
            derOctetString(derSequence(Buffer.alloc(0))),
          ]),
        );
        const kuBits = Buffer.from([0x05, 0xa0]);
        const keyUsage = derSequence(
          Buffer.concat([
            derOID(KEY_USAGE_OID),
            derBoolean(true),
            derOctetString(Buffer.concat([Buffer.from([0x03]), encodeDERLength(kuBits.length), kuBits])),
          ]),
        );
        const extKeyUsage = derSequence(
          Buffer.concat([derOID(EXT_KEY_USAGE_OID), derOctetString(derSequence(derOID(CLIENT_AUTH_OID)))]),
        );
        const clientPubHash = crypto.createHash('sha1').update(clientPubDer).digest();
        const ski = derSequence(
          Buffer.concat([derOID(SUBJECT_KEY_IDENTIFIER_OID), derOctetString(derOctetString(clientPubHash))]),
        );
        const extensions = derContextTag(
          3,
          derSequence(Buffer.concat([basicConstraints, keyUsage, extKeyUsage, ski])),
        );

        const version = derContextTag(0, derInteger(2));
        const tbsCert = derSequence(
          Buffer.concat([
            version,
            derInteger(serial),
            sigAlgDER(),
            issuerDN,
            validity,
            subjectDN,
            clientPubDer,
            extensions,
          ]),
        );

        const signer = crypto.createSign('SHA256');
        signer.update(tbsCert);
        const signature = signer.sign(caKeyPem);
        const cert = derSequence(Buffer.concat([tbsCert, sigAlgDER(), derBitString(signature)]));
        const certLines = cert.toString('base64').match(/.{1,64}/g);
        const certPem =
          '-----BEGIN CERTIFICATE-----\n' +
          (certLines ? certLines.join('\n') : cert.toString('base64')) +
          '\n-----END CERTIFICATE-----\n';

        return { success: true, privateKey: clientKeyPem, certificate: certPem, csr: generatedCsr };
      } catch (e: unknown) {
        const error = e instanceof Error ? e.message : String(e);
        return { success: false, error };
      }
    },
  );
}
