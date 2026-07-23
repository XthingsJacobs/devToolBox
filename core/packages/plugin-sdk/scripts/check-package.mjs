import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(packageDir, 'dist');
const requiredFiles = [
  'index.js',
  'index.d.ts',
  'index.js.map',
  'index.d.ts.map',
  'react.js',
  'react.d.ts',
  'react.js.map',
  'react.d.ts.map',
  'README.md',
  'LICENSE',
  'package.json',
  'src/index.ts',
  'src/react.tsx',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(distDir, file))) throw new Error(`Missing SDK package file: ${file}`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'package.json'), 'utf8'));
if (manifest.private || manifest.dependencies)
  throw new Error('SDK release package must be public and standalone');
for (const entry of [
  manifest.main,
  manifest.types,
  ...Object.values(manifest.exports).flatMap((value) => {
    if (typeof value === 'string') return [value];
    return Object.values(value);
  }),
]) {
  if (entry === './package.json') continue;
  if (typeof entry !== 'string' || !fs.existsSync(path.join(distDir, entry))) {
    throw new Error(`Broken SDK package export: ${String(entry)}`);
  }
}

for (const file of ['index.js', 'index.d.ts', 'react.js', 'react.d.ts', 'src/index.ts', 'src/react.tsx']) {
  const content = fs.readFileSync(path.join(distDir, file), 'utf8');
  if (content.includes('@devtoolbox/core') || content.includes('workspace:')) {
    throw new Error(`SDK package leaks a private workspace dependency: ${file}`);
  }
}

for (const file of fs.readdirSync(distDir).filter((name) => name.endsWith('.map'))) {
  const mapPath = path.join(distDir, file);
  const sourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  for (const source of sourceMap.sources ?? []) {
    const sourcePath = path.resolve(path.dirname(mapPath), sourceMap.sourceRoot ?? '', source);
    if (!sourcePath.startsWith(`${distDir}${path.sep}`) || !fs.existsSync(sourcePath)) {
      throw new Error(`Broken SDK source map reference in ${file}: ${source}`);
    }
  }
}

process.stdout.write('Plugin SDK package validation passed.\n');
