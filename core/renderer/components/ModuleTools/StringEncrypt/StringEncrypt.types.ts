export type AesMode = 'CBC' | 'GCM';
export type LocaleText = (key: string) => string;

export interface HashResult {
  alg: string;
  label: string;
  value: string;
}

export interface HmacResult {
  alg: string;
  label: string;
  value: string;
}

export interface AesResult {
  mode: AesMode;
  result: string;
  iv: string;
  error?: string;
}

export interface EncodedResult {
  label: string;
  value: string;
}
