import { describe, expect, it } from 'vitest';
import {
  convertJsonYamlInput,
  formatJsonInput,
  getTextStats,
  jsonToYamlString,
  normalizeJsonValue,
  toYaml,
  yamlKey,
  yamlScalar,
  yamlToJsonString,
} from '../JsonYamlConverter.model';

describe('JsonYamlConverter model', () => {
  it('computes text stats using existing empty-output semantics', () => {
    expect(getTextStats('a b\nc')).toEqual({ length: 5, spaces: 1, lines: 2 });
    expect(getTextStats('')).toEqual({ length: 0, spaces: 0, lines: 0 });
  });

  it('quotes YAML scalars and keys only when required', () => {
    expect(yamlScalar('plain-value')).toBe('plain-value');
    expect(yamlScalar('true')).toBe('"true"');
    expect(yamlScalar('needs space')).toBe('"needs space"');
    expect(yamlKey('needs space')).toBe('"needs space"');
  });

  it('normalizes unsupported values and renders nested YAML', () => {
    const normalized = normalizeJsonValue({ ok: true, bad: Number.NaN, nested: { list: [1, 'two'] } });

    expect(normalized).toEqual({ ok: true, bad: null, nested: { list: [1, 'two'] } });
    expect(toYaml(normalized)).toBe('ok: true\nbad: null\nnested:\n  list:\n    - 1\n    - two');
  });

  it('converts JSON to YAML and YAML back to pretty JSON', () => {
    expect(jsonToYamlString({ name: 'Ada', enabled: true })).toBe('name: Ada\nenabled: true\n');
    expect(JSON.parse(yamlToJsonString('name: Ada\nenabled: true'))).toEqual({ name: 'Ada', enabled: true });
  });

  it('formats and converts valid input while reporting parse errors', () => {
    expect(formatJsonInput('{"b":2,"a":1}')).toEqual({ ok: true, output: '{\n  "b": 2,\n  "a": 1\n}\n' });
    expect(convertJsonYamlInput('jsonToYaml', '{bad')?.ok).toBe(false);
    expect(convertJsonYamlInput('yamlToJson', 'name: Ada')).toMatchObject({ ok: true });
    expect(convertJsonYamlInput('jsonToYaml', '   ')).toBeNull();
  });
});
