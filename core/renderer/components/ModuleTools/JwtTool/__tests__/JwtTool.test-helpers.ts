import { base64UrlEncodeText, type OidcVerifyLabels } from '../JwtTool.model';

export const labels = {
  decodeError: 'decode error',
  verifyValid: 'valid',
  verifyInvalid: 'invalid',
  verifyExpired: 'expired',
  verifyNotBefore: 'not before',
};

export const oidcLabels: OidcVerifyLabels = {
  decodeError: 'decode error',
  oidcMissingIss: 'missing iss',
  oidcHmacNotSupported: 'hmac not supported',
  oidcUnsupportedAlg: 'unsupported alg',
  oidcStart: 'oidc start',
  oidcDiscoveryFailed: 'discovery failed',
  oidcInvalidDiscovery: 'invalid discovery',
  oidcIssuerMismatch: 'issuer mismatch',
  oidcDiscoveryOk: 'discovery ok',
  jwksFetchFailed: 'jwks fetch failed',
  jwksNoKeys: 'jwks no keys',
  jwksFetchOk: 'jwks fetch ok',
  jwksKidNotFound: 'kid not found',
  verifyValid: 'valid',
  verifyInvalid: 'invalid',
  claimsMissingExp: 'missing exp',
  verifyExpired: 'expired',
  claimsExpOk: 'exp ok',
  verifyNotBefore: 'not before',
  claimsNbfOk: 'nbf ok',
  claimsMissingAud: 'missing aud',
  claimsAudOk: 'aud ok',
  claimsAudBad: 'aud bad',
  claimsIssOk: 'iss ok',
  claimsIssBad: 'iss bad',
};

export function jwt(header: unknown, payload: unknown, signature = 'signature'): string {
  return `${base64UrlEncodeText(JSON.stringify(header))}.${base64UrlEncodeText(
    JSON.stringify(payload),
  )}.${signature}`;
}
