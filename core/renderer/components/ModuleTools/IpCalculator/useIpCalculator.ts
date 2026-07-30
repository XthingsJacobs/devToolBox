import { useMemo, useState } from 'react';
import {
  binaryIPv4,
  formatIPv4,
  ipClass,
  ipv4ToIPv6Mapped,
  maskFromPrefix,
  minimalCoverCidr,
  parseIPv4,
  parseIPv4WithMask,
} from './ipv4';

export type IpCalculatorTranslate = (key: string) => string;

export function useIpCalculator(t: IpCalculatorTranslate) {
  const [cidrInput, setCidrInput] = useState('192.168.0.1/24');
  const [ipInput, setIpInput] = useState('192.168.1.1');
  const [rangeStart, setRangeStart] = useState('192.168.1.1');
  const [rangeEnd, setRangeEnd] = useState('192.168.6.255');

  const subnet = useMemo(() => {
    const parsed = parseIPv4WithMask(cidrInput);
    if (!parsed) return { ok: false as const, error: t('invalid') };
    const { ip, prefix } = parsed;
    const mask = maskFromPrefix(prefix);
    const network = (ip & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const wildcard = (~mask >>> 0) >>> 0;
    const size = prefix === 32 ? 1 : 2 ** (32 - prefix);
    const first = prefix >= 31 ? network : (network + 1) >>> 0;
    const last = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;
    return {
      ok: true as const,
      network,
      prefix,
      mask,
      wildcard,
      size,
      first,
      last,
      broadcast,
      className: ipClass(ip),
    };
  }, [cidrInput, t]);

  const converted = useMemo(() => {
    const ip = parseIPv4(ipInput);
    if (ip === null) return { ok: false as const, error: t('invalid') };
    const dec = BigInt(ip >>> 0).toString(10);
    const hex = (ip >>> 0).toString(16).toUpperCase().padStart(8, '0');
    const bin = binaryIPv4(ip, false);
    const ipv6 = ipv4ToIPv6Mapped(ip);
    return {
      ok: true as const,
      dec,
      hex,
      bin,
      ipv6: ipv6.full,
      ipv6Short: ipv6.short,
    };
  }, [ipInput, t]);

  const range = useMemo(() => {
    const parsedStart = parseIPv4(rangeStart);
    const parsedEnd = parseIPv4(rangeEnd);
    if (parsedStart === null || parsedEnd === null) return { ok: false as const, error: t('invalid') };
    const start = parsedStart >>> 0;
    const end = parsedEnd >>> 0;
    if (start > end) return { ok: false as const, error: t('invalid') };
    const oldCount = BigInt(end - start + 1);
    const cover = minimalCoverCidr(start, end);
    const newCount = BigInt(cover.prefix === 32 ? 1 : 2 ** (32 - cover.prefix));
    return {
      ok: true as const,
      oldStart: start,
      oldEnd: end,
      oldCount,
      newStart: cover.network,
      newEnd: cover.broadcast,
      newCount,
      cidr: `${formatIPv4(cover.network)}/${cover.prefix}`,
    };
  }, [rangeEnd, rangeStart, t]);

  return {
    cidrInput,
    setCidrInput,
    ipInput,
    setIpInput,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    subnet,
    converted,
    range,
  };
}
