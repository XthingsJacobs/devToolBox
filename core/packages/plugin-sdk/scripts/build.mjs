import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryDir = path.resolve(packageDir, '../../..');
const distDir = path.join(packageDir, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
const tscPath = require.resolve('typescript/bin/tsc');
const result = spawnSync(process.execPath, [tscPath, '-p', path.join(packageDir, 'tsconfig.build.json')], {
  cwd: packageDir,
  stdio: 'inherit',
});
if (result.status !== 0) process.exit(result.status ?? 1);

const sourceManifest = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const publishManifest = {
  name: sourceManifest.name,
  version: sourceManifest.version,
  description: sourceManifest.description,
  keywords: sourceManifest.keywords,
  homepage: sourceManifest.homepage,
  repository: sourceManifest.repository,
  bugs: sourceManifest.bugs,
  license: sourceManifest.license,
  type: 'module',
  main: './index.js',
  types: './index.d.ts',
  exports: {
    '.': { types: './index.d.ts', import: './index.js', default: './index.js' },
    './react': { types: './react.d.ts', import: './react.js', default: './react.js' },
    './package.json': './package.json',
  },
  peerDependencies: sourceManifest.peerDependencies,
  peerDependenciesMeta: sourceManifest.peerDependenciesMeta,
  publishConfig: { access: 'public' },
};

fs.copyFileSync(path.join(packageDir, 'README.md'), path.join(distDir, 'README.md'));
fs.copyFileSync(path.join(repositoryDir, 'LICENSE'), path.join(distDir, 'LICENSE'));
fs.mkdirSync(path.join(distDir, 'src'), { recursive: true });
fs.copyFileSync(path.join(packageDir, 'src/index.ts'), path.join(distDir, 'src/index.ts'));
fs.copyFileSync(path.join(packageDir, 'src/react.tsx'), path.join(distDir, 'src/react.tsx'));
for (const file of fs.readdirSync(distDir).filter((name) => name.endsWith('.map'))) {
  const mapPath = path.join(distDir, file);
  const sourceMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  sourceMap.sources = (sourceMap.sources ?? []).map((source) =>
    source.startsWith('../src/') ? `./src/${source.slice('../src/'.length)}` : source,
  );
  fs.writeFileSync(mapPath, JSON.stringify(sourceMap), 'utf8');
}
fs.writeFileSync(path.join(distDir, 'package.json'), `${JSON.stringify(publishManifest, null, 2)}\n`, 'utf8');
