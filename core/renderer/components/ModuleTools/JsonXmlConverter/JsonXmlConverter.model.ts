import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type { ConversionResult, JsonXmlMode, TextStats } from './JsonXmlConverter.types';

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getTextStats(text: string): TextStats {
  const length = text.length;
  const spaces = (text.match(/ /g) || []).length;
  const lines = text ? (text.match(/\n/g) || []).length + 1 : 0;
  return { length, spaces, lines };
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

export function jsonToXmlString(json: unknown): string {
  const normalized = normalizeJsonValue(json);
  const rootValue = Array.isArray(normalized) ? { item: normalized } : normalized;
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true,
  });
  return `${builder.build({ root: rootValue })}\n`;
}

export function xmlToJsonString(xml: string): string {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xml);
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

export function convertJsonXmlInput(mode: JsonXmlMode, input: string): ConversionResult | null {
  const raw = input.trim();
  if (!raw) return null;

  if (mode === 'jsonToXml') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return { ok: true, output: jsonToXmlString(parsed) };
    } catch (error) {
      return { ok: false, errorKind: 'json', message: errorMessage(error) };
    }
  }

  try {
    return { ok: true, output: xmlToJsonString(raw) };
  } catch (error) {
    return { ok: false, errorKind: 'xml', message: errorMessage(error) };
  }
}
