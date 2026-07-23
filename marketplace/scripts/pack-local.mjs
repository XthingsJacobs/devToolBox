import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { packPlugin } from './pack-utils.mjs';
import { signMarketplaceEntry, signingConfigFromEnvironment } from './provenance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const modulesDir = path.join(root, 'modules');
const signingConfig = signingConfigFromEnvironment();

const args = process.argv.slice(2).filter((x) => x && x !== '--');
const merge = args.includes('--merge');
const all = args.includes('--all');

let ids = args.filter((x) => !x.startsWith('--'));
if (all) {
  ids = fs
    .readdirSync(modulesDir)
    .filter((name) => name && name.startsWith('market-'))
    .filter((name) => fs.existsSync(path.join(modulesDir, name, 'manifest.json')));
}

if (!ids.length) {
  console.error(
    'Usage: node marketplace/scripts/pack-local.mjs [--all] [--merge] <plugin-id> [plugin-id...]',
  );
  process.exit(1);
}

const outDir = path.join(root, '.local-dist');
fs.mkdirSync(outDir, { recursive: true });

const entries = ids.map((id) =>
  packPlugin({
    modulesDir,
    outDir,
    id,
    getDownloadUrl: (zipPath) => pathToFileURL(zipPath).toString(),
    signEntry: signingConfig ? (entry) => signMarketplaceEntry(entry, signingConfig) : undefined,
  }),
);

const registryPath = path.join(root, 'registry.local.json');
let plugins = entries;
if (merge && fs.existsSync(registryPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const list = Array.isArray(existing?.plugins) ? existing.plugins : [];
    const map = new Map(list.map((e) => [e?.manifest?.id, e]).filter(([id]) => Boolean(id)));
    for (const e of entries) map.set(e.manifest.id, e);
    plugins = Array.from(map.values()).sort((a, b) =>
      String(a.manifest.id).localeCompare(String(b.manifest.id)),
    );
  } catch {
    plugins = entries;
  }
}

const registry = { schemaVersion: 1, plugins };
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

console.log(`Local registry written: ${pathToFileURL(registryPath).toString()}`);
