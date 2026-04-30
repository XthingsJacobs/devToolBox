/**
 * Shared ASN.1 DER encoding utilities.
 */

export function encodeDERLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x100) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

export function derSequence(contents: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0x30]), encodeDERLength(contents.length), contents]);
}

export function derSet(contents: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0x31]), encodeDERLength(contents.length), contents]);
}

export function derOID(oid: number[]): Buffer {
  const first = oid[0] * 40 + oid[1];
  const bytes = [first];
  for (let i = 2; i < oid.length; i++) {
    let val = oid[i];
    if (val >= 0x80) {
      const enc: number[] = [];
      enc.unshift(val & 0x7f);
      val >>= 7;
      while (val > 0) {
        enc.unshift((val & 0x7f) | 0x80);
        val >>= 7;
      }
      bytes.push(...enc);
    } else {
      bytes.push(val);
    }
  }
  const buf = Buffer.from(bytes);
  return Buffer.concat([Buffer.from([0x06]), encodeDERLength(buf.length), buf]);
}

export function derUTF8String(str: string): Buffer {
  const buf = Buffer.from(str, 'utf-8');
  return Buffer.concat([Buffer.from([0x0c]), encodeDERLength(buf.length), buf]);
}

export function derPrintableString(str: string): Buffer {
  const buf = Buffer.from(str, 'ascii');
  return Buffer.concat([Buffer.from([0x13]), encodeDERLength(buf.length), buf]);
}

export function derInteger(val: Buffer | number): Buffer {
  let buf: Buffer;
  if (typeof val === 'number') {
    if (val === 0) {
      buf = Buffer.from([0]);
    } else {
      const hex = val.toString(16);
      buf = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
      if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]);
    }
  } else {
    buf = val;
    if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]);
  }
  return Buffer.concat([Buffer.from([0x02]), encodeDERLength(buf.length), buf]);
}

export function derBitString(data: Buffer): Buffer {
  const content = Buffer.concat([Buffer.from([0x00]), data]);
  return Buffer.concat([Buffer.from([0x03]), encodeDERLength(content.length), content]);
}

export function derOctetString(data: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0x04]), encodeDERLength(data.length), data]);
}

export function derBoolean(val: boolean): Buffer {
  return Buffer.from([0x01, 0x01, val ? 0xff : 0x00]);
}

export function derContextTag(tag: number, content: Buffer, constructed = true): Buffer {
  const tagByte = constructed ? 0xa0 | tag : 0x80 | tag;
  return Buffer.concat([Buffer.from([tagByte]), encodeDERLength(content.length), content]);
}

export function derUTCTime(date: Date): Buffer {
  const y = date.getUTCFullYear() % 100;
  const str = [
    y.toString().padStart(2, '0'),
    (date.getUTCMonth() + 1).toString().padStart(2, '0'),
    date.getUTCDate().toString().padStart(2, '0'),
    date.getUTCHours().toString().padStart(2, '0'),
    date.getUTCMinutes().toString().padStart(2, '0'),
    date.getUTCSeconds().toString().padStart(2, '0'),
    'Z',
  ].join('');
  const buf = Buffer.from(str, 'ascii');
  return Buffer.concat([Buffer.from([0x17]), encodeDERLength(buf.length), buf]);
}

export function parseDERTag(
  buf: Buffer,
  offset: number,
): { tag: number; length: number; valueOffset: number; totalLength: number } {
  const tag = buf[offset];
  let length = 0;
  let valueOffset = offset + 2;
  if (buf[offset + 1] & 0x80) {
    const numBytes = buf[offset + 1] & 0x7f;
    for (let i = 0; i < numBytes; i++) length = (length << 8) | buf[offset + 2 + i];
    valueOffset = offset + 2 + numBytes;
  } else {
    length = buf[offset + 1];
  }
  return { tag, length, valueOffset, totalLength: valueOffset - offset + length };
}

export function skipDERElement(buf: Buffer, offset: number): number {
  return offset + parseDERTag(buf, offset).totalLength;
}

/** Common OIDs */
export const SUBJECT_OIDS: Record<string, number[]> = {
  CN: [2, 5, 4, 3],
  C: [2, 5, 4, 6],
  ST: [2, 5, 4, 8],
  L: [2, 5, 4, 7],
  O: [2, 5, 4, 10],
  OU: [2, 5, 4, 11],
};

export const SHA256_WITH_RSA = [1, 2, 840, 113549, 1, 1, 11];
export const BASIC_CONSTRAINTS_OID = [2, 5, 29, 19];
export const KEY_USAGE_OID = [2, 5, 29, 15];
export const EXT_KEY_USAGE_OID = [2, 5, 29, 37];
export const CLIENT_AUTH_OID = [1, 3, 6, 1, 5, 5, 7, 3, 2];
export const SUBJECT_KEY_IDENTIFIER_OID = [2, 5, 29, 14];

/** Build Subject DN */
export function buildSubjectDN(fields: {
  commonName?: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  state?: string;
  locality?: string;
}): Buffer {
  const { commonName, organization, organizationalUnit, country, state, locality } = fields;
  const rdnEntries: { key: string; value: string }[] = [];
  if (country) rdnEntries.push({ key: 'C', value: country });
  if (state) rdnEntries.push({ key: 'ST', value: state });
  if (locality) rdnEntries.push({ key: 'L', value: locality });
  if (organization) rdnEntries.push({ key: 'O', value: organization });
  if (organizationalUnit) rdnEntries.push({ key: 'OU', value: organizationalUnit });
  if (commonName) rdnEntries.push({ key: 'CN', value: commonName });

  const rdnSets = rdnEntries.map(({ key, value }) => {
    const oid = derOID(SUBJECT_OIDS[key]);
    const val = key === 'C' ? derPrintableString(value) : derUTF8String(value);
    return derSet(derSequence(Buffer.concat([oid, val])));
  });
  return derSequence(Buffer.concat(rdnSets));
}

/** Signature algorithm DER */
export function sigAlgDER(): Buffer {
  return derSequence(Buffer.concat([derOID(SHA256_WITH_RSA), Buffer.from([0x05, 0x00])]));
}
