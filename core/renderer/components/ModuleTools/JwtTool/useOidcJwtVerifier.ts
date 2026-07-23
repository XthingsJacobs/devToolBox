import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { networkService } from '../../../services';
import { isRecord, type JwtJsonFetchResult, verifyOidcJwt, type OidcVerifyLabels } from './JwtTool.model';
import type { JwtLocaleText, OidcVerifierState } from './JwtTool.types';

const EMPTY_OIDC_STATE: OidcVerifierState = {
  result: [],
  info: null,
  decoded: null,
  jwksKid: '',
  jwksKey: null,
};

function buildOidcLabels(mt: JwtLocaleText): OidcVerifyLabels {
  return {
    decodeError: mt('decodeError'),
    oidcMissingIss: mt('oidcMissingIss'),
    oidcHmacNotSupported: mt('oidcHmacNotSupported'),
    oidcUnsupportedAlg: mt('oidcUnsupportedAlg'),
    oidcStart: mt('oidcStart'),
    oidcDiscoveryFailed: mt('oidcDiscoveryFailed'),
    oidcInvalidDiscovery: mt('oidcInvalidDiscovery'),
    oidcIssuerMismatch: mt('oidcIssuerMismatch'),
    oidcDiscoveryOk: mt('oidcDiscoveryOk'),
    jwksFetchFailed: mt('jwksFetchFailed'),
    jwksNoKeys: mt('jwksNoKeys'),
    jwksFetchOk: mt('jwksFetchOk'),
    jwksKidNotFound: mt('jwksKidNotFound'),
    verifyValid: mt('verifyValid'),
    verifyInvalid: mt('verifyInvalid'),
    claimsMissingExp: mt('claimsMissingExp'),
    verifyExpired: mt('verifyExpired'),
    claimsExpOk: mt('claimsExpOk'),
    verifyNotBefore: mt('verifyNotBefore'),
    claimsNbfOk: mt('claimsNbfOk'),
    claimsMissingAud: mt('claimsMissingAud'),
    claimsAudOk: mt('claimsAudOk'),
    claimsAudBad: mt('claimsAudBad'),
    claimsIssOk: mt('claimsIssOk'),
    claimsIssBad: mt('claimsIssBad'),
  };
}

export function useOidcJwtVerifier(mt: JwtLocaleText) {
  const [token, setToken] = useState('');
  const [auto, setAuto] = useState(true);
  const [allowHttp, setAllowHttp] = useState(false);
  const [audience, setAudience] = useState('');
  const [skew, setSkew] = useState('120');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<OidcVerifierState>(EMPTY_OIDC_STATE);
  const busyRef = useRef(false);
  const cacheRef = useRef(new Map<string, { ts: number; data: unknown }>());

  const labels = useMemo(() => buildOidcLabels(mt), [mt]);

  const requestJson = useCallback(
    async (url: string): Promise<JwtJsonFetchResult> => {
      const now = Date.now();
      const cacheKey = `${allowHttp ? 'http-ok' : 'https-only'}:${url}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached && now - cached.ts < 10 * 60 * 1000) return { ok: true, data: cached.data };

      const request = networkService.httpRequest({
        url,
        method: 'GET',
        responseType: 'json',
        allowHttp,
        timeoutMs: 15000,
      });
      if (!request) {
        return { ok: false, error: { code: 'not_supported', message: 'httpRequest not available' } };
      }

      const response = (await request) as unknown;
      const record = isRecord(response) ? response : {};
      if (record.ok === true) {
        const dataRecord = isRecord(record.data) ? record.data : {};
        const data = dataRecord.data;
        cacheRef.current.set(cacheKey, { ts: now, data });
        return { ok: true, data };
      }

      const error = isRecord(record.error) ? record.error : {};
      const code = typeof error.code === 'string' ? error.code : 'network_error';
      const message = typeof error.message === 'string' ? error.message : 'Network error';
      return { ok: false, error: { code, message } };
    },
    [allowHttp],
  );

  const verify = useCallback(async () => {
    if (busyRef.current) return;
    const trimmed = token.trim();
    setState(EMPTY_OIDC_STATE);
    if (!trimmed) return;

    busyRef.current = true;
    setBusy(true);
    try {
      const result = await verifyOidcJwt({
        token: trimmed,
        audience,
        skewSeconds: Number(skew) || 0,
        labels,
        fetchJson: requestJson,
      });
      setState(result);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [audience, labels, requestJson, skew, token]);

  useEffect(() => {
    if (!auto) return;
    if (!token.trim()) return;
    const timer = window.setTimeout(() => {
      void verify();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [auto, token, verify]);

  return {
    token,
    setToken,
    auto,
    setAuto,
    allowHttp,
    setAllowHttp,
    audience,
    setAudience,
    skew,
    setSkew,
    busy,
    verify,
    ...state,
  };
}
