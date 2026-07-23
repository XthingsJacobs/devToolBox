export type VerifyMessage = { type: 'success' | 'error' | 'warning'; msg: string };

export interface DecodedJwt {
  header: string;
  payload: string;
  signature: string;
}

export type JwtLocaleText = (key: string) => string;
export type JwtCopyHandler = (value: string) => void;

export interface OidcInfo {
  issuer?: string;
  jwksUri?: string;
}

export interface OidcVerifierState {
  result: VerifyMessage[];
  info: OidcInfo | null;
  decoded: DecodedJwt | null;
  jwksKid: string;
  jwksKey: string | null;
}
