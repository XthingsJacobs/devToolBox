import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PERMISSIONS = new Set([
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

function isRecord(value) {
  return typeof value === 'object' && value !== null;
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

function requireString(manifest, field, errors, prefix) {
  if (typeof manifest[field] !== 'string' || !manifest[field].trim())
    errors.push(`${prefix}: missing ${field}`);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function localeKeys(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return Array.from(raw.matchAll(/^\s*(?:'([^']+)'|([A-Za-z0-9_]+)):/gm), (match) => match[1] ?? match[2]);
}

function checkLocalizedManifest(manifest, errors, prefix) {
  if (!isRecord(manifest.i18n)) {
    errors.push(`${prefix}: manifest.i18n is required`);
    return;
  }
  for (const locale of ['en', 'zh-CN']) {
    const block = manifest.i18n[locale];
    if (!isRecord(block)) {
      errors.push(`${prefix}: manifest.i18n.${locale} is required`);
      continue;
    }
    if (typeof block.name !== 'string' || !block.name.trim()) {
      errors.push(`${prefix}: manifest.i18n.${locale}.name is missing`);
    }
    if (typeof block.description !== 'string' || !block.description.trim()) {
      errors.push(`${prefix}: manifest.i18n.${locale}.description is missing`);
    }
  }
}

async function checkPluginI18nFiles(moduleDir, errors, prefix) {
  const legacySingleFile = path.join(moduleDir, 'src/i18n.ts');
  if (await exists(legacySingleFile)) {
    errors.push(`${prefix}: use src/i18n/en.ts and src/i18n/zh-CN.ts instead of src/i18n.ts`);
  }

  const enPath = path.join(moduleDir, 'src/i18n/en.ts');
  const zhPath = path.join(moduleDir, 'src/i18n/zh-CN.ts');
  const enExists = await exists(enPath);
  const zhExists = await exists(zhPath);
  if (!enExists) errors.push(`${prefix}: missing src/i18n/en.ts`);
  if (!zhExists) errors.push(`${prefix}: missing src/i18n/zh-CN.ts`);
  if (!enExists || !zhExists) return;

  const enKeys = await localeKeys(enPath);
  const zhKeys = await localeKeys(zhPath);
  const missing = enKeys.filter((key) => !zhKeys.includes(key));
  const extra = zhKeys.filter((key) => !enKeys.includes(key));
  if (missing.length) errors.push(`${prefix}: src/i18n/zh-CN.ts is missing keys: ${missing.join(', ')}`);
  if (extra.length) errors.push(`${prefix}: src/i18n/zh-CN.ts has extra keys: ${extra.join(', ')}`);
}

async function main() {
  const baseDir = path.join(rootDir, 'marketplace/modules');
  const folders = (await readdir(baseDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const errors = [];
  const ids = new Set();

  for (const folder of folders) {
    const prefix = `marketplace/${folder}`;
    const moduleDir = path.join(baseDir, folder);
    let manifest;
    try {
      manifest = JSON.parse(await readFile(path.join(moduleDir, 'manifest.json'), 'utf8'));
    } catch {
      errors.push(`${prefix}: missing or invalid manifest.json`);
      continue;
    }
    if (!isRecord(manifest)) {
      errors.push(`${prefix}: manifest.json must contain an object`);
      continue;
    }

    const id = typeof manifest.id === 'string' ? manifest.id.trim() : '';
    if (!id) errors.push(`${prefix}: manifest.id is missing`);
    else {
      if (!isKebabCaseId(id)) errors.push(`${prefix}: manifest.id must be kebab-case: ${id}`);
      if (!id.startsWith('market-')) errors.push(`${prefix}: manifest.id must start with "market-": ${id}`);
      if (id !== folder) errors.push(`${prefix}: folder name must match manifest.id`);
      if (ids.has(id)) errors.push(`${prefix}: duplicate manifest.id: ${id}`);
      ids.add(id);
    }

    for (const field of [
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
    ]) {
      requireString(manifest, field, errors, prefix);
    }
    checkLocalizedManifest(manifest, errors, prefix);
    if (manifest.sdkVersion !== '1.0') {
      errors.push(`${prefix}: unsupported sdkVersion: ${String(manifest.sdkVersion)}`);
    }

    const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
    if (!permissions.length) errors.push(`${prefix}: permissions must be a non-empty array`);
    for (const permission of permissions) {
      if (typeof permission !== 'string' || !PERMISSIONS.has(permission)) {
        errors.push(`${prefix}: unsupported permission: ${String(permission)}`);
      }
    }

    const needsDomains = permissions.includes('http:external') || permissions.includes('http:proxy');
    const domains = Array.isArray(manifest.httpDomains) ? manifest.httpDomains : [];
    if (needsDomains && !domains.length) errors.push(`${prefix}: httpDomains is required for network access`);
    for (const domain of domains) {
      if (!isHttpDomain(domain)) errors.push(`${prefix}: invalid httpDomain: ${String(domain)}`);
    }

    await checkPluginI18nFiles(moduleDir, errors, prefix);
  }

  if (errors.length) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Marketplace validation passed (${folders.length} modules).\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});
