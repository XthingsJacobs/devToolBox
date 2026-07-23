import { useCallback, useEffect, useMemo, useState } from 'react';
import { aesEncrypt, buildEncodingResults, calculateHashes, calculateHmacs } from './StringEncrypt.model';
import type { AesMode, AesResult, HashResult, HmacResult } from './StringEncrypt.types';

export function useStringEncryptController() {
  const [input, setInput] = useState('');
  const [hmacKey, setHmacKey] = useState('');
  const [aesKey, setAesKey] = useState('');
  const [aesIv, setAesIv] = useState('');
  const [aesMode, setAesMode] = useState<AesMode>('CBC');
  const [hashes, setHashes] = useState<HashResult[]>([]);
  const [hmacs, setHmacs] = useState<HmacResult[]>([]);
  const [aesResult, setAesResult] = useState<AesResult | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const encodings = useMemo(() => (input ? buildEncodingResults(input) : []), [input]);

  const toggle = useCallback((key: string) => {
    setCollapsed((previous) => ({ ...previous, [key]: !previous[key] }));
  }, []);

  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  useEffect(() => {
    if (!input) {
      setHashes([]);
      setHmacs([]);
      setAesResult(null);
      return;
    }
    let active = true;
    void calculateHashes(input).then((results) => {
      if (active) setHashes(results);
    });
    return () => {
      active = false;
    };
  }, [input]);

  useEffect(() => {
    if (!input || !hmacKey) {
      setHmacs([]);
      return;
    }
    let active = true;
    void calculateHmacs(input, hmacKey)
      .then((results) => {
        if (active) setHmacs(results);
      })
      .catch(() => {
        if (active) setHmacs([]);
      });
    return () => {
      active = false;
    };
  }, [hmacKey, input]);

  useEffect(() => {
    if (!input || !aesKey) {
      setAesResult(null);
      return;
    }
    let active = true;
    void aesEncrypt(input, aesKey, aesIv, aesMode)
      .then((result) => {
        if (active) setAesResult(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAesResult({
          mode: aesMode,
          result: '',
          iv: '',
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      active = false;
    };
  }, [aesIv, aesKey, aesMode, input]);

  return {
    input,
    hmacKey,
    aesKey,
    aesIv,
    aesMode,
    hashes,
    hmacs,
    encodings,
    aesResult,
    collapsed,
    onInputChange: setInput,
    onHmacKeyChange: setHmacKey,
    onAesKeyChange: setAesKey,
    onAesIvChange: setAesIv,
    onAesModeChange: setAesMode,
    onToggle: toggle,
    onCopy: copy,
  };
}
