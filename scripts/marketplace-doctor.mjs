import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const modulesDir = path.join(rootDir, 'marketplace', 'modules');

const permissions = new Set([
  'http:external',
  'http:proxy',
  'fs:dialog',
  'fs:read',
  'fs:write',
  'storage:kv',
  'bluetooth',
  'serial',
  'usb',
  'system:openExternal',
  'system:revealPath',
  'system:openPath',
  'system:notifications',
  'system:env:read',
  'system:getInfo',
]);

const requiredManifestFields = [
  'id',
  'name',
  'description',
  'version',
  'sdkVersion',
  'entry',
  'categoryId',
  'author',
  'license',
  'homepage',
  'repository',
];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKebabCaseId(id) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}

function isHttpDomain(domain) {
  if (typeof domain !== 'string' || !domain || domain.includes('://') || domain.includes('/')) return false;
  if (domain === '*' || domain.includes('**')) return false;
  if (domain.includes('*') && !domain.startsWith('*.')) return false;
  const host = domain.startsWith('*.') ? domain.slice(2) : domain;
  return host.includes('.') && !host.includes('*') && /^[a-z0-9.-]+$/i.test(host);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    return { ok: true, data: JSON.parse(await readFile(filePath, 'utf8')) };
  } catch (error) {
    return { ok: false, error };
  }
}

async function localeKeys(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return Array.from(raw.matchAll(/^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_]+)):/gm), (match) => {
    return match[1] ?? match[2] ?? match[3];
  });
}

function addError(result, message, fix) {
  result.errors.push({ message, fix });
}

function addWarn(result, message, fix) {
  result.warnings.push({ message, fix });
}

async function checkRequiredFile(result, moduleDir, relativePath, fix) {
  if (!(await exists(path.join(moduleDir, relativePath)))) {
    addError(result, `Missing ${relativePath}`, fix);
  }
}

async function diagnosePlugin(pluginId) {
  const result = { pluginId, errors: [], warnings: [], notes: [] };
  if (!isKebabCaseId(pluginId)) {
    addError(result, `Invalid plugin id: ${pluginId}`, 'Use kebab-case, for example market-json-query.');
    return result;
  }
  if (!pluginId.startsWith('market-')) {
    addError(result, `Invalid plugin id: ${pluginId}`, 'Marketplace plugin IDs must start with market-.');
    return result;
  }

  const moduleDir = path.join(modulesDir, pluginId);
  if (!(await exists(moduleDir))) {
    addError(result, `Plugin folder not found: marketplace/modules/${pluginId}`, 'Run plugin create first or check the plugin ID.');
    return result;
  }

  const manifestPath = path.join(moduleDir, 'manifest.json');
  const manifestJson = await readJson(manifestPath);
  if (!manifestJson.ok || !isRecord(manifestJson.data)) {
    addError(result, 'Missing or invalid manifest.json', 'Fix JSON syntax and make sure the manifest root is an object.');
    return result;
  }

  const manifest = manifestJson.data;
  for (const field of requiredManifestFields) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
      addError(result, `manifest.${field} is missing`, `Add a non-empty string field named ${field}.`);
    }
  }

  if (manifest.id !== pluginId) {
    addError(result, `manifest.id (${String(manifest.id)}) does not match folder name (${pluginId})`, 'Rename the folder or update manifest.id.');
  }
  if (manifest.sdkVersion !== '1.0') {
    addError(result, `Unsupported manifest.sdkVersion: ${String(manifest.sdkVersion)}`, 'Use sdkVersion "1.0" until a newer SDK is supported.');
  }
  if (manifest.entry !== 'package/index.html') {
    addWarn(result, `Unexpected manifest.entry: ${String(manifest.entry)}`, 'Use package/index.html unless this plugin has a custom package layout.');
  }

  if (!isRecord(manifest.i18n)) {
    addError(result, 'manifest.i18n is missing', 'Add i18n.en and i18n.zh-CN blocks with name and description.');
  } else {
    for (const locale of ['en', 'zh-CN']) {
      const block = manifest.i18n[locale];
      if (!isRecord(block)) {
        addError(result, `manifest.i18n.${locale} is missing`, `Add manifest.i18n.${locale}.name and manifest.i18n.${locale}.description.`);
      } else {
        if (typeof block.name !== 'string' || !block.name.trim()) {
          addError(result, `manifest.i18n.${locale}.name is missing`, 'Add a localized Marketplace display name.');
        }
        if (typeof block.description !== 'string' || !block.description.trim()) {
          addError(result, `manifest.i18n.${locale}.description is missing`, 'Add a localized Marketplace description.');
        }
      }
    }
  }

  const declaredPermissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  if (!declaredPermissions.length) {
    addError(result, 'manifest.permissions must be a non-empty array', 'Declare only the SDK capabilities the plugin actually uses.');
  }
  for (const permission of declaredPermissions) {
    if (typeof permission !== 'string' || !permissions.has(permission)) {
      addError(result, `Unsupported permission: ${String(permission)}`, 'Use one of the supported PluginPermission values.');
    }
  }

  const needsDomains = declaredPermissions.includes('http:external') || declaredPermissions.includes('http:proxy');
  const domains = Array.isArray(manifest.httpDomains) ? manifest.httpDomains : [];
  if (needsDomains && !domains.length) {
    addError(result, 'manifest.httpDomains is required for network permissions', 'Add each allowed host, for example api.example.com.');
  }
  if (!needsDomains && domains.length) {
    addWarn(result, 'manifest.httpDomains is set but no network permission is declared', 'Remove httpDomains or add http:external/http:proxy.');
  }
  for (const domain of domains) {
    if (!isHttpDomain(domain)) {
      addError(result, `Invalid httpDomain: ${String(domain)}`, 'Use hostnames only. Do not include protocol, path, or broad wildcards.');
    }
  }

  await checkRequiredFile(result, moduleDir, 'package.json', 'Create the plugin package.json or rerun plugin create.');
  await checkRequiredFile(result, moduleDir, 'index.html', 'Create the Vite HTML entry file.');
  await checkRequiredFile(result, moduleDir, 'src/main.tsx', 'Create the React entry and call mountPlugin.');
  await checkRequiredFile(result, moduleDir, 'src/App.tsx', 'Create the main React component.');

  const packageJson = await readJson(path.join(moduleDir, 'package.json'));
  if (packageJson.ok && isRecord(packageJson.data)) {
    const expectedName = `@devtoolbox/plugin-${pluginId}`;
    if (packageJson.data.name !== expectedName) {
      addWarn(result, `package.json name is ${String(packageJson.data.name)}`, `Use ${expectedName} for workspace filters.`);
    }
    const scripts = isRecord(packageJson.data.scripts) ? packageJson.data.scripts : {};
    if (typeof scripts.build !== 'string') {
      addError(result, 'package.json scripts.build is missing', 'Add a build script that typechecks and runs Vite.');
    }
    if (typeof scripts.dev !== 'string') {
      addWarn(result, 'package.json scripts.dev is missing', 'Add a dev script for local Vite iteration.');
    }
  }

  const legacyI18n = path.join(moduleDir, 'src', 'i18n.ts');
  if (await exists(legacyI18n)) {
    addError(result, 'Legacy src/i18n.ts found', 'Use src/i18n/en.ts and src/i18n/zh-CN.ts instead.');
  }

  const enPath = path.join(moduleDir, 'src', 'i18n', 'en.ts');
  const zhPath = path.join(moduleDir, 'src', 'i18n', 'zh-CN.ts');
  const hasEn = await exists(enPath);
  const hasZh = await exists(zhPath);
  if (!hasEn) addError(result, 'Missing src/i18n/en.ts', 'Add English UI strings.');
  if (!hasZh) addError(result, 'Missing src/i18n/zh-CN.ts', 'Add Simplified Chinese UI strings.');
  if (hasEn && hasZh) {
    const enKeys = await localeKeys(enPath);
    const zhKeys = await localeKeys(zhPath);
    const missing = enKeys.filter((key) => !zhKeys.includes(key));
    const extra = zhKeys.filter((key) => !enKeys.includes(key));
    if (missing.length) addError(result, `src/i18n/zh-CN.ts is missing keys: ${missing.join(', ')}`, 'Keep locale keys in sync.');
    if (extra.length) addWarn(result, `src/i18n/zh-CN.ts has extra keys: ${extra.join(', ')}`, 'Remove unused keys or add them to en.ts.');
  }

  const packageEntry = path.join(moduleDir, 'package', 'index.html');
  if (await exists(packageEntry)) {
    result.notes.push('Package output exists: package/index.html');
  } else {
    addWarn(result, 'Package output is missing: package/index.html', `Run pnpm --filter @devtoolbox/plugin-${pluginId} build before packing.`);
  }

  const localZipDir = path.join(rootDir, 'marketplace', '.local-dist');
  const hasLocalZip =
    (await exists(localZipDir)) &&
    (await readdir(localZipDir)).some((fileName) => fileName.startsWith(`${pluginId}-`) && fileName.endsWith('.zip'));
  if (hasLocalZip) {
    result.notes.push('Local package ZIP exists in marketplace/.local-dist.');
  } else {
    addWarn(result, 'No local package ZIP found in marketplace/.local-dist', `Run ./cli.sh plugin ${pluginId} or .\\cli.ps1 plugin ${pluginId}.`);
  }

  return result;
}

function printResult(result) {
  process.stdout.write(`\n${result.pluginId}\n`);
  if (!result.errors.length && !result.warnings.length) {
    process.stdout.write('[OK] Plugin diagnostics passed\n');
  }
  for (const note of result.notes) process.stdout.write(`[INFO] ${note}\n`);
  for (const warning of result.warnings) {
    process.stdout.write(`[WARN] ${warning.message}\n`);
    if (warning.fix) process.stdout.write(`       Fix: ${warning.fix}\n`);
  }
  for (const error of result.errors) {
    process.stdout.write(`[ERROR] ${error.message}\n`);
    if (error.fix) process.stdout.write(`        Fix: ${error.fix}\n`);
  }
}

async function pluginIdsFromArgs(args) {
  const target = args[0] ?? '';
  if (!target || target === '--help' || target === '-h') {
    process.stdout.write('Usage: node scripts/marketplace-doctor.mjs <market-id|all>\n');
    return [];
  }
  if (target === 'all' || target === '--all') {
    return (await readdir(modulesDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('market-'))
      .map((entry) => entry.name)
      .sort();
  }
  return [target];
}

async function main() {
  const pluginIds = await pluginIdsFromArgs(process.argv.slice(2));
  if (!pluginIds.length) return;

  const results = [];
  for (const pluginId of pluginIds) {
    results.push(await diagnosePlugin(pluginId));
  }
  for (const result of results) printResult(result);

  const errorCount = results.reduce((total, result) => total + result.errors.length, 0);
  const warningCount = results.reduce((total, result) => total + result.warnings.length, 0);
  process.stdout.write(`\nMarketplace doctor complete: ${errorCount} error(s), ${warningCount} warning(s).\n`);
  if (errorCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});
