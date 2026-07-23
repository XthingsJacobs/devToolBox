import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repositoryDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(repositoryDir, 'dist');
const manifestPath = path.join(distDir, '.vite', 'manifest.json');

const budgets = {
  entryJavaScript: { raw: 360 * 1024, gzip: 115 * 1024 },
  entryCss: { raw: 40 * 1024, gzip: 9 * 1024 },
  genericJavaScript: { raw: 525 * 1024, gzip: 150 * 1024 },
  heavyJavaScript: [
    { prefix: 'bwip-renderer-', raw: 1024 * 1024, gzip: 300 * 1024 },
    { prefix: 'js-obfuscator-engine-', raw: 1800 * 1024, gzip: 520 * 1024 },
  ],
};

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)} KiB`;
}

function readAsset(relativePath) {
  const filePath = path.join(distDir, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`Missing build asset: ${relativePath}`);
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

if (!fs.existsSync(manifestPath)) {
  process.stderr.write('Bundle manifest not found. Run `pnpm build` first.\n');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
if (!entryKey) throw new Error('The Vite manifest does not contain an application entry.');

const staticEntries = new Set();
function collectStaticEntries(key) {
  if (staticEntries.has(key)) return;
  const entry = manifest[key];
  if (!entry) throw new Error(`Manifest import is missing: ${key}`);
  staticEntries.add(key);
  for (const importedKey of entry.imports ?? []) collectStaticEntries(importedKey);
}
collectStaticEntries(entryKey);

const entryJavaScript = { raw: 0, gzip: 0 };
const entryCss = { raw: 0, gzip: 0 };
const entryCssFiles = new Set();
for (const key of staticEntries) {
  const entry = manifest[key];
  if (entry.file?.endsWith('.js')) {
    const size = readAsset(entry.file);
    entryJavaScript.raw += size.raw;
    entryJavaScript.gzip += size.gzip;
  }
  for (const cssFile of entry.css ?? []) entryCssFiles.add(cssFile);
}
for (const cssFile of entryCssFiles) {
  const size = readAsset(cssFile);
  entryCss.raw += size.raw;
  entryCss.gzip += size.gzip;
}

const errors = [];
check('Initial JavaScript', entryJavaScript, budgets.entryJavaScript, errors);
check('Initial CSS', entryCss, budgets.entryCss, errors);

const assetsDir = path.join(distDir, 'assets');
for (const fileName of fs
  .readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .sort()) {
  const heavyBudget = budgets.heavyJavaScript.find((item) => fileName.startsWith(item.prefix));
  const budget = heavyBudget ?? budgets.genericJavaScript;
  check(`Chunk ${fileName}`, readAsset(path.join('assets', fileName)), budget, errors);
}

if (errors.length > 0) {
  process.stderr.write(`\nBundle budget failed:\n- ${errors.join('\n- ')}\n`);
  process.exit(1);
}

process.stdout.write('\nBundle budget passed.\n');
