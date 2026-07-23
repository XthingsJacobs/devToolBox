import { describe, expect, it } from 'vitest';
import {
  convertJsonXmlInput,
  formatJsonInput,
  getTextStats,
  jsonToXmlString,
  normalizeJsonValue,
  xmlToJsonString,
} from '../JsonXmlConverter.model';

describe('JsonXmlConverter model', () => {
  it('computes text stats using existing empty-output semantics', () => {
    expect(getTextStats('a b\nc')).toEqual({ length: 5, spaces: 1, lines: 2 });
    expect(getTextStats('')).toEqual({ length: 0, spaces: 0, lines: 0 });
  });

  it('normalizes unsupported JSON values into serializable values', () => {
    expect(normalizeJsonValue({ ok: true, bad: Number.NaN, missing: undefined })).toEqual({
      ok: true,
      bad: null,
      missing: 'undefined',
    });
  });

  it('converts JSON values to XML under a stable root element', () => {
    const output = jsonToXmlString({ user: { name: 'Ada' }, enabled: true });

    expect(output).toContain('<root>');
    expect(output).toContain('<name>Ada</name>');
    expect(output).toContain('<enabled>true</enabled>');
    expect(output.endsWith('\n')).toBe(true);
  });

  it('converts XML values back to pretty JSON', () => {
    const output = xmlToJsonString('<root><name>Ada</name><enabled>true</enabled></root>');

    expect(JSON.parse(output)).toEqual({ root: { name: 'Ada', enabled: true } });
    expect(output.endsWith('\n')).toBe(true);
  });

  it('formats and converts valid input while reporting parse errors', () => {
    expect(formatJsonInput('{"b":2,"a":1}')).toEqual({ ok: true, output: '{\n  "b": 2,\n  "a": 1\n}\n' });
    expect(convertJsonXmlInput('jsonToXml', '{bad')?.ok).toBe(false);
    expect(convertJsonXmlInput('xmlToJson', '<root><name>Ada</name></root>')).toMatchObject({ ok: true });
    expect(convertJsonXmlInput('jsonToXml', '   ')).toBeNull();
  });
});
