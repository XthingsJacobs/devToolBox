import type { CodeLanguage, PresetRegex, RegexHighlightClasses, RegexMatch } from './RegexTester.types';

export const PRESETS: PresetRegex[] = [
  { label: 'presetChinese', pattern: '[\\u4e00-\\u9fa5]', flags: 'g' },
  { label: 'presetDoubleByte', pattern: '[^\\x00-\\xff]', flags: 'g' },
  { label: 'presetBlankLine', pattern: '\\n\\s*\\r', flags: 'g' },
  { label: 'presetEmail', pattern: '[\\w.-]+@[\\w.-]+\\.\\w+', flags: 'g' },
  { label: 'URL', pattern: "https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+", flags: 'g' },
  { label: 'presetMobile', pattern: '1[3-9]\\d{9}', flags: 'g' },
  { label: 'presetPhone', pattern: '\\d{3}-\\d{8}|\\d{4}-\\d{7,8}', flags: 'g' },
  { label: 'presetNegFloat', pattern: '-\\d+\\.\\d+', flags: 'g' },
  { label: 'presetInteger', pattern: '-?\\d+', flags: 'g' },
  { label: 'presetPosFloat', pattern: '\\d+\\.\\d+', flags: 'g' },
  { label: 'presetQQ', pattern: '[1-9]\\d{4,}', flags: 'g' },
  { label: 'presetPostal', pattern: '[1-9]\\d{5}(?!\\d)', flags: 'g' },
  { label: 'presetIP', pattern: '\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}', flags: 'g' },
  { label: 'presetIDCard', pattern: '\\d{17}[\\dXx]|\\d{15}', flags: 'g' },
  { label: 'presetDate', pattern: '\\d{4}-\\d{1,2}-\\d{1,2}', flags: 'g' },
  { label: 'presetPosInt', pattern: '[1-9]\\d*', flags: 'g' },
  { label: 'presetNegInt', pattern: '-[1-9]\\d*', flags: 'g' },
  { label: 'presetUsername', pattern: '[a-zA-Z]\\w{3,15}', flags: 'g' },
];

export function buildRegexFlags({
  global,
  ignoreCase,
  multiline,
}: {
  global: boolean;
  ignoreCase: boolean;
  multiline: boolean;
}): string {
  let flags = '';
  if (global) flags += 'g';
  if (ignoreCase) flags += 'i';
  if (multiline) flags += 'm';
  return flags;
}

export function compileRegex(pattern: string, flags: string): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function findRegexMatches(pattern: string, flags: string, testText: string): RegexMatch[] {
  const regex = compileRegex(pattern, flags);
  if (!regex || !testText) return [];
  const result: RegexMatch[] = [];
  const matcher = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(testText)) !== null) {
    result.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    if (match[0].length === 0) matcher.lastIndex += 1;
  }
  return result;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildHighlightedHtml({
  text,
  matches,
  highlightNoMatch,
  classes,
}: {
  text: string;
  matches: RegexMatch[];
  highlightNoMatch: boolean;
  classes: RegexHighlightClasses;
}): string {
  if (!text) return '';
  if (matches.length === 0) {
    return highlightNoMatch
      ? `<span class="${classes.noMatch}">${escapeHtml(text)}</span>`
      : escapeHtml(text);
  }

  const parts: string[] = [];
  let last = 0;
  for (const match of matches) {
    if (match.start > last) {
      const segment = testSegment(text, last, match.start, highlightNoMatch, classes.noMatch);
      parts.push(segment);
    }
    parts.push(`<span class="${classes.match}">${escapeHtml(match.text)}</span>`);
    last = match.end;
  }
  if (last < text.length) parts.push(testSegment(text, last, text.length, highlightNoMatch, classes.noMatch));
  return parts.join('');
}

function testSegment(
  text: string,
  start: number,
  end: number,
  highlightNoMatch: boolean,
  className: string,
): string {
  const segment = escapeHtml(text.slice(start, end));
  return highlightNoMatch ? `<span class="${className}">${segment}</span>` : segment;
}

export function replaceRegexMatches(
  pattern: string,
  flags: string,
  testText: string,
  replacement: string,
): string {
  const regex = compileRegex(pattern, flags);
  if (!regex || !testText || !replacement) return '';
  try {
    return testText.replace(regex, replacement);
  } catch {
    return '';
  }
}

export function generateCode(pattern: string, flags: string, language: CodeLanguage): string {
  const escapedDouble = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escapedSingle = pattern.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  switch (language) {
    case 'JavaScript':
      return `const regex = /${pattern}/${flags};\nconst result = regex.test(str);\nconst matches = str.match(regex);`;
    case 'Python':
      return `import re\n\npattern = r"${pattern}"\nresult = re.findall(pattern, text${flags.includes('i') ? ', re.IGNORECASE' : ''})`;
    case 'Java':
      return `import java.util.regex.*;\n\nPattern pattern = Pattern.compile("${escapedDouble}"${flags.includes('i') ? ', Pattern.CASE_INSENSITIVE' : ''});\nMatcher matcher = pattern.matcher(text);\nwhile (matcher.find()) {\n    System.out.println(matcher.group());\n}`;
    case 'Go':
      return `import "regexp"\n\nre := regexp.MustCompile(\`${pattern}\`)\nmatches := re.FindAllString(text, -1)`;
    case 'C#':
      return `using System.Text.RegularExpressions;\n\nvar regex = new Regex(@"${pattern}"${flags.includes('i') ? ', RegexOptions.IgnoreCase' : ''});\nvar matches = regex.Matches(text);`;
    case 'PHP':
      return `$pattern = '/${escapedSingle}/${flags}';\npreg_match_all($pattern, $text, $matches);`;
    case 'Ruby':
      return `regex = /${pattern}/${flags.replace('g', '')}\nmatches = text.scan(regex)`;
    case 'Rust':
      return `use regex::Regex;\n\nlet re = Regex::new(r"${pattern}").unwrap();\nlet matches: Vec<&str> = re.find_iter(text).map(|m| m.as_str()).collect();`;
    default:
      return '';
  }
}
