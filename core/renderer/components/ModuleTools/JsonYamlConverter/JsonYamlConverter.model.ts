import yamlParser from 'js-yaml';
import type { ConversionResult, JsonYamlMode, TextStats } from './JsonYamlConverter.types';

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | {
      [k: string]: JsonValue;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: JsonValue): value is null | boolean | number | string {
  return (
    value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getTextStats(text: string): TextStats {
  const length = text.length;
  const spaces = (text.match(/ /g) || []).length;
  const lines = text ? (text.match(/\n/g) || []).length + 1 : 0;
  return { length, spaces, lines };
}

export function yamlScalar(value: null | boolean | number | string): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  const scalar = String(value);
  if (scalar === '') return '""';
  if (/^[A-Za-z0-9_./-]+$/.test(scalar) && !/^(true|false|null|~|yes|no|on|off)$/i.test(scalar)) {
    return scalar;
  }
  return JSON.stringify(scalar);
}

export function yamlKey(key: string): string {
  const normalized = String(key);
  if (/^[A-Za-z0-9_-]+$/.test(normalized)) return normalized;
  return JSON.stringify(normalized);
}

export function normalizeJsonValue(input: unknown): JsonValue {
  if (input === null) return null;
  if (typeof input === 'string') return input;
  if (typeof input === 'boolean') return input;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (Array.isArray(input)) return input.map((item) => normalizeJsonValue(item));
  if (isPlainObject(input)) {
    const output: Record<string, JsonValue> = {};
    Object.keys(input).forEach((key) => {
      output[key] = normalizeJsonValue(input[key]);
    });
    return output;
  }
  return String(input);
}

export function toYaml(value: JsonValue, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (isScalar(value)) return `${pad}${yamlScalar(value)}`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value
      .map((item) => {
        if (isScalar(item)) return `${pad}- ${yamlScalar(item)}`;
        const body = toYaml(item, indent + 2);
        return `${pad}-\n${body}`;
      })
      .join('\n');
  }

  const objectValue = value as Record<string, JsonValue>;
  const keys = Object.keys(objectValue);
  if (keys.length === 0) return `${pad}{}`;
  return keys
    .map((key) => {
      const childValue = objectValue[key];
      const outputKey = yamlKey(key);
      if (childValue === undefined) return `${pad}${outputKey}: null`;
      if (isScalar(childValue)) return `${pad}${outputKey}: ${yamlScalar(childValue)}`;
      return `${pad}${outputKey}:\n${toYaml(childValue, indent + 2)}`;
    })
    .join('\n');
}

export function jsonToYamlString(json: unknown): string {
  const output = toYaml(normalizeJsonValue(json), 0);
  return output.endsWith('\n') ? output : `${output}\n`;
}

export function yamlToJsonString(yaml: string): string {
  const parsed = yamlParser.load(yaml);
  const normalized = normalizeJsonValue(parsed);
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function formatJsonInput(raw: string): ConversionResult {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return { ok: true, output: `${JSON.stringify(parsed, null, 2)}\n` };
  } catch (error) {
    return { ok: false, errorKind: 'json', message: errorMessage(error) };
  }
}

export function convertJsonYamlInput(mode: JsonYamlMode, input: string): ConversionResult | null {
  const raw = input.trim();
  if (!raw) return null;

  if (mode === 'jsonToYaml') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return { ok: true, output: jsonToYamlString(parsed) };
    } catch (error) {
      return { ok: false, errorKind: 'json', message: errorMessage(error) };
    }
  }

  try {
    return { ok: true, output: yamlToJsonString(raw) };
  } catch (error) {
    return { ok: false, errorKind: 'yaml', message: errorMessage(error) };
  }
}
