import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repositoryDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = path.join(repositoryDir, 'marketplace', 'modules');

const budgets = {
  initialJavaScript: { raw: 180 * 1024, gzip: 60 * 1024 },
  initialCss: { raw: 16 * 1024, gzip: 5 * 1024 },
  genericJavaScript: { raw: 220 * 1024, gzip: 70 * 1024 },
  pluginHeavyJavaScript: {
    'market-emoji-search': [{ prefix: 'compact-', raw: 625 * 1024, gzip: 105 * 1024 }],
  },
};

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)} KiB`;
}

function readSize(filePath) {
  const contents = fs.readFileSync(filePath);
  return { raw: contents.length, gzip: gzipSync(contents).length };
}

function check(label, actual, budget, errors) {
  const detail = `${label}: ${formatBytes(actual.raw)} raw / ${formatBytes(actual.gzip)} gzip`;
  if (actual.raw > budget.raw || actual.gzip > budget.gzip) {
    errors.push(`${detail} exceeds ${formatBytes(budget.raw)} raw / ${formatBytes(budget.gzip)} gzip`);
  } else {
    process.stdout.write(`${detail}\n`);
  }
}

const moduleNames = fs
  .readdirSync(modulesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const errors = [];

for (const moduleName of moduleNames) {
  const packageDir = path.join(modulesDir, moduleName, 'package');
  const manifestPath = path.join(packageDir, '.vite', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push(`${moduleName}: manifest not found; run \`pnpm -C marketplace build\` first`);
    continue;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
  if (!entryKey) {
    errors.push(`${moduleName}: Vite manifest has no entry`);
    continue;
  }

  const staticEntries = new Set();
  function collectStaticEntries(key) {
    if (staticEntries.has(key)) return;
    const entry = manifest[key];
    if (!entry) {
      errors.push(`${moduleName}: missing manifest import ${key}`);
      return;
    }
    staticEntries.add(key);
    for (const importedKey of entry.imports ?? []) collectStaticEntries(importedKey);
  }
  collectStaticEntries(entryKey);

  const initialJavaScript = { raw: 0, gzip: 0 };
  const initialCss = { raw: 0, gzip: 0 };
  const cssFiles = new Set();
  for (const key of staticEntries) {
    const entry = manifest[key];
    if (entry?.file?.endsWith('.js')) {
      const size = readSize(path.join(packageDir, entry.file));
      initialJavaScript.raw += size.raw;
      initialJavaScript.gzip += size.gzip;
    }
    for (const cssFile of entry?.css ?? []) cssFiles.add(cssFile);
  }
  for (const cssFile of cssFiles) {
    const size = readSize(path.join(packageDir, cssFile));
    initialCss.raw += size.raw;
    initialCss.gzip += size.gzip;
  }

  process.stdout.write(`\n${moduleName}\n`);
  check('  Initial JavaScript', initialJavaScript, budgets.initialJavaScript, errors);
  check('  Initial CSS', initialCss, budgets.initialCss, errors);

  const assetsDir = path.join(packageDir, 'assets');
  const heavyBudgets = budgets.pluginHeavyJavaScript[moduleName] ?? [];
  for (const fileName of fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .sort()) {
    const budget = heavyBudgets.find((item) => fileName.startsWith(item.prefix)) ?? budgets.genericJavaScript;
    check(`  Chunk ${fileName}`, readSize(path.join(assetsDir, fileName)), budget, errors);
  }
}

if (errors.length > 0) {
  process.stderr.write(`\nMarketplace bundle budget failed:\n- ${errors.join('\n- ')}\n`);
  process.exit(1);
}

process.stdout.write('\nMarketplace bundle budget passed.\n');
