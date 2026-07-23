import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { packPlugin, removePath } from './pack-utils.mjs';
import {
  assertSigningEntryTrusted,
  signMarketplaceEntry,
  signingConfigFromEnvironment,
} from './provenance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const modulesDir = path.join(root, 'modules');
const signingConfig = signingConfigFromEnvironment();
const trustConfig = JSON.parse(
  fs.readFileSync(path.resolve(root, '../core/main/marketplace/trusted-publishers.json'), 'utf8'),
);

const repo = String(process.env.GITHUB_REPOSITORY ?? '').trim();
if (!repo) {
  console.error('Missing env GITHUB_REPOSITORY (expected like "owner/repo")');
  process.exit(1);
}

const tag = String(process.env.MARKETPLACE_TAG ?? 'marketplace').trim();
if (!tag) {
  console.error('Missing env MARKETPLACE_TAG');
  process.exit(1);
}

const outDir = path.join(root, 'release-dist');
removePath(outDir);
fs.mkdirSync(outDir, { recursive: true });

function writeEmptyRegistry() {
  const registry = { schemaVersion: 1, plugins: [] };
  const registryPath = path.join(outDir, 'registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
  process.stdout.write(`No marketplace modules found. Empty registry written: ${registryPath}\n`);
}

if (!fs.existsSync(modulesDir)) {
  writeEmptyRegistry();
  process.exit(0);
}

const ids = process.argv.slice(2);
const resolvedIds = ids.length
  ? ids
  : fs.readdirSync(modulesDir).filter((n) => fs.statSync(path.join(modulesDir, n)).isDirectory());
if (!resolvedIds.length) {
  writeEmptyRegistry();
  process.exit(0);
}

const entries = resolvedIds.map((id) =>
  packPlugin({
    modulesDir,
    outDir,
    id,
    getDownloadUrl: (_zipPath, zipName) => `https://github.com/${repo}/releases/download/${tag}/${zipName}`,
    signEntry: signingConfig
      ? (entry) => {
          assertSigningEntryTrusted(entry, signingConfig, trustConfig);
          return signMarketplaceEntry(entry, signingConfig);
        }
      : undefined,
  }),
);

const registry = { schemaVersion: 1, plugins: entries };
const registryPath = path.join(outDir, 'registry.json');
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
process.stdout.write(`Marketplace release artifacts ready: ${outDir}\n`);
