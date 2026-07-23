import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function removePath(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    return;
  }
}

function copyDir(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const name of fs.readdirSync(source)) {
    if (name === '.vite') continue;
    const sourcePath = path.join(source, name);
    const destinationPath = path.join(destination, name);
    if (fs.statSync(sourcePath).isDirectory()) copyDir(sourcePath, destinationPath);
    else fs.copyFileSync(sourcePath, destinationPath);
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function packPlugin({ modulesDir, outDir, id, getDownloadUrl, signEntry }) {
  const pluginDir = path.join(modulesDir, id);
  const manifestPath = path.join(pluginDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`manifest.json not found: ${manifestPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const version = String(manifest.version || '').trim();
  const entry = String(manifest.entry || '')
    .trim()
    .replace(/^\.\/+/, '');
  if (!version) throw new Error(`Invalid manifest.version for ${id}`);
  if (!entry) throw new Error(`Invalid manifest.entry for ${id}`);

  const builtEntryPath = path.join(pluginDir, entry);
  if (!fs.existsSync(builtEntryPath)) {
    throw new Error(
      `Entry not built yet: ${builtEntryPath}. Run pnpm --filter @devtoolbox/plugin-${id} build`,
    );
  }

  const staging = path.join(outDir, `${id}-${version}`);
  removePath(staging);
  fs.mkdirSync(staging, { recursive: true });
  fs.copyFileSync(manifestPath, path.join(staging, 'manifest.json'));

  const entryRoot = entry.split('/')[0];
  const entryRootPath = path.join(pluginDir, entryRoot);
  if (!fs.existsSync(entryRootPath)) throw new Error(`Entry root not found: ${entryRootPath}`);
  copyDir(entryRootPath, path.join(staging, entryRoot));

  const zipName = `${id}-${version}.zip`;
  const zipPath = path.join(outDir, zipName);
  removePath(zipPath);
  execFileSync('zip', ['-qr', zipPath, 'manifest.json', entryRoot], { cwd: staging, stdio: 'inherit' });

  const registryEntry = {
    manifest: { ...manifest },
    downloadUrl: getDownloadUrl(zipPath, zipName),
    sha256: sha256File(zipPath),
    size: fs.statSync(zipPath).size,
    publishedAt: new Date().toISOString(),
    status: 'active',
  };
  return signEntry ? signEntry(registryEntry) : registryEntry;
}
