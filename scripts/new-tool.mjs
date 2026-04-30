import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const result = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i];
    if (!cur.startsWith('-')) {
      result._.push(cur);
      continue;
    }

    const eqIdx = cur.indexOf('=');
    if (eqIdx !== -1) {
      const k = cur.slice(0, eqIdx);
      const v = cur.slice(eqIdx + 1);
      result.flags[k] = v;
      continue;
    }

    if (cur === '--with-help') {
      result.flags[cur] = true;
      continue;
    }

    const next = argv[i + 1];
    if (next != null && !next.startsWith('-')) {
      result.flags[cur] = next;
      i += 1;
    } else {
      result.flags[cur] = true;
    }
  }
  return result;
}

function toPascalCase(name) {
  const cleaned = name.trim().replace(/[\\/]/g, '');
  if (!cleaned) return '';
  if (/^[A-Z][A-Za-z0-9]*$/.test(cleaned)) return cleaned;
  return cleaned
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function toKebabCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function getCategoryIds() {
  const placeholderPath = path.join(rootDir, 'core/renderer/data/placeholder.ts');
  const raw = await readFile(placeholderPath, 'utf8');
  const ids = new Set();
  for (const m of raw.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*icon:/g)) {
    ids.add(m[1]);
  }
  return Array.from(ids);
}

function usage() {
  return [
    'Usage:',
    '  pnpm new:tool <ToolName> [--category <categoryId>] [--id <moduleId>] [--name <displayName>] [--description <desc>] [--with-help]',
    '',
    'Examples:',
    '  pnpm new:tool TimestampConverter --category dev-tools',
    '  pnpm new:tool UrlCodec --id core-url-encode --with-help',
    '',
    'Interactive mode:',
    '  pnpm new:tool',
    '',
  ].join('\n');
}

function buildIndexTsx({ componentName, folderName, withHelp }) {
  if (withHelp) {
    return `import { useMemo, useState } from 'react';
import { marked } from 'marked';
import sp from '@@components/SplitPane/SplitPane.module.css';
import ResponsiveActions from '@components/ResponsiveActions';
import { useSplitPane, HelpModal, ToolSection } from '@@components';
import { useI18n, getModuleLocale } from '../../../i18n';

import helpEn from './locales/help-en.md?raw';

export default function ${componentName}() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, '${folderName}');
  const mt = (key: string) => localeData?.[key] ?? key;

  const helpHtml = useMemo(() => {
    return marked.parse(helpEn, { breaks: true, gfm: true }) as string;
  }, [locale]);

  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { splitPercent, containerRef, handleMouseDown } = useSplitPane(50);

  const handleRun = () => {
    setOutput(input);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={sp.container} ref={containerRef}>
      <div className={sp.pane} style={{ width: splitPercent + '%' }}>
        <ToolSection
          fill
          bodyVariant="noPad"
          title={mt('input')}
          actions={
            <ResponsiveActions
              actions={[
                { label: mt('run'), onClick: handleRun },
                { label: mt('clear'), onClick: handleClear },
                { label: mt('help'), onClick: () => setShowHelp(true) },
              ]}
            />
          }
        >
          <textarea
            className={sp.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mt('placeholder')}
            spellCheck={false}
          />
        </ToolSection>
      </div>

      <div className={sp.divider} onMouseDown={handleMouseDown} />

      <div className={sp.pane} style={{ width: 100 - splitPercent + '%' }}>
        <ToolSection
          fill
          bodyVariant="noPad"
          title={mt('result')}
          actions={
            <ResponsiveActions
              actions={[
                { label: copied ? mt('copied') : mt('copy'), onClick: handleCopy },
              ]}
            />
          }
        >
          <div className={sp.outputWrap}>
            <pre className={sp.output}>{output}</pre>
          </div>
        </ToolSection>
      </div>

      {showHelp && (
        <HelpModal title={mt('helpTitle')} onClose={() => setShowHelp(false)}>
          <div dangerouslySetInnerHTML={{ __html: helpHtml }} />
        </HelpModal>
      )}
    </div>
  );
}
`;
  }

  return `import { useState } from 'react';
import sp from '@@components/SplitPane/SplitPane.module.css';
import ResponsiveActions from '@components/ResponsiveActions';
import { useSplitPane, ToolSection } from '@@components';
import { useI18n, getModuleLocale } from '../../../i18n';

export default function ${componentName}() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, '${folderName}');
  const mt = (key: string) => localeData?.[key] ?? key;

  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const { splitPercent, containerRef, handleMouseDown } = useSplitPane(50);

  const handleRun = () => {
    setOutput(input);
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={sp.container} ref={containerRef}>
      <div className={sp.pane} style={{ width: splitPercent + '%' }}>
        <ToolSection
          fill
          bodyVariant="noPad"
          title={mt('input')}
          actions={
            <ResponsiveActions
              actions={[
                { label: mt('run'), onClick: handleRun },
                { label: mt('clear'), onClick: handleClear },
              ]}
            />
          }
        >
          <textarea
            className={sp.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mt('placeholder')}
            spellCheck={false}
          />
        </ToolSection>
      </div>

      <div className={sp.divider} onMouseDown={handleMouseDown} />

      <div className={sp.pane} style={{ width: 100 - splitPercent + '%' }}>
        <ToolSection
          fill
          bodyVariant="noPad"
          title={mt('result')}
          actions={
            <ResponsiveActions
              actions={[
                { label: copied ? mt('copied') : mt('copy'), onClick: handleCopy },
              ]}
            />
          }
        >
          <div className={sp.outputWrap}>
            <pre className={sp.output}>{output}</pre>
          </div>
        </ToolSection>
      </div>
    </div>
  );
}
`;
}

async function main() {
  const { _, flags } = parseArgs(process.argv.slice(2));
  if (flags['--help'] || flags['-h']) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const categories = await getCategoryIds();

  try {
    let folderName = toPascalCase(_[0] ?? '');
    if (!folderName) {
      const v = await rl.question('Tool folder name (PascalCase, e.g. TimestampConverter): ');
      folderName = toPascalCase(v);
    }
    if (!folderName) {
      process.stderr.write('Error: tool folder name is required.\n');
      process.exitCode = 1;
      return;
    }

    const componentName = folderName.replace(/[^A-Za-z0-9_]/g, '');
    if (!componentName) {
      process.stderr.write('Error: invalid component name.\n');
      process.exitCode = 1;
      return;
    }

    let moduleId = String(flags['--id'] ?? '');
    if (!moduleId) {
      const suggested = `core-${toKebabCase(folderName)}`;
      const v = await rl.question(`Module id (default: ${suggested}): `);
      moduleId = (v || suggested).trim();
    }
    if (!moduleId) {
      process.stderr.write('Error: module id is required.\n');
      process.exitCode = 1;
      return;
    }
    if (!moduleId.startsWith('core-')) moduleId = `core-${toKebabCase(moduleId)}`;

    let categoryId = String(flags['--category'] ?? '');
    if (!categoryId) {
      const v = await rl.question(`categoryId (available: ${categories.join(', ')}, default: dev-tools): `);
      categoryId = (v || 'dev-tools').trim();
    }
    if (!categories.includes(categoryId)) {
      process.stderr.write(`Error: unknown categoryId: ${categoryId}\n`);
      process.exitCode = 1;
      return;
    }

    let name = String(flags['--name'] ?? '');
    if (!name) {
      const v = await rl.question(`Display name (default: ${folderName}): `);
      name = (v || folderName).trim();
    }

    let description = String(flags['--description'] ?? '');
    if (!description) {
      const v = await rl.question(`Description (default: ${name} tool): `);
      description = (v || `${name} tool`).trim();
    }

    let withHelp = Boolean(flags['--with-help']);
    if (!flags['--with-help'] && _[0] == null) {
      const v = await rl.question('Generate help docs? (y/N): ');
      withHelp = ['y', 'yes'].includes(v.trim().toLowerCase());
    }

    const moduleDir = path.join(rootDir, 'core/renderer/components/ModuleTools', folderName);
    if (await fileExists(moduleDir)) {
      process.stderr.write(`Error: folder already exists: ${moduleDir}\n`);
      process.exitCode = 1;
      return;
    }

    await mkdir(path.join(moduleDir, 'locales'), { recursive: true });

    if (withHelp) {
      await writeFile(
        path.join(moduleDir, 'locales/help-en.md'),
        `# ${name}\n\n- Description\n- Examples\n`,
        'utf8',
      );
    }

    await writeFile(
      path.join(moduleDir, 'locales/en.ts'),
      `export default {\n  name: '${name}',\n  description: '${description}',\n  input: 'Input',\n  run: 'Run',\n  clear: 'Clear',\n  help: 'Help',\n  placeholder: 'Enter text...',\n  result: 'Result',\n  copy: 'Copy',\n  copied: 'Copied',\n  helpTitle: '${name}',\n};\n`,
      'utf8',
    );

    await writeFile(
      path.join(moduleDir, 'config.tsx'),
      `import type { ModuleConfig } from '../../../types';\nimport ${componentName} from './index';\n\nconst config: ModuleConfig = {\n  id: '${moduleId}',\n  name: '${name}',\n  description: '${description}',\n  categoryId: '${categoryId}',\n  component: ${componentName},\n};\n\nexport default config;\n`,
      'utf8',
    );

    await writeFile(path.join(moduleDir, `${folderName}.module.css`), `.root {\n}\n`, 'utf8');

    await writeFile(
      path.join(moduleDir, 'index.tsx'),
      buildIndexTsx({ componentName, folderName, withHelp }),
      'utf8',
    );

    process.stdout.write(`Created: ${moduleDir}\n`);
    process.stdout.write('Tip: run `pnpm lint:modules` to validate the module structure.\n');
  } finally {
    await rl.close();
  }
}

main().catch((err) => {
  process.stderr.write(`${String(err?.stack || err)}\n`);
  process.exitCode = 1;
});
