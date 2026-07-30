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

function addError(errors, prefix, message, fix) {
  errors.push(`${prefix}: ${message}. Fix: ${fix}`);
}

function requireString(manifest, field, errors, prefix) {
  if (typeof manifest[field] !== 'string' || !manifest[field].trim())
    addError(errors, prefix, `missing ${field}`, `add a non-empty string field named ${field}`);
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
    addError(errors, prefix, 'manifest.i18n is required', 'add i18n.en and i18n.zh-CN metadata blocks');
    return;
  }
  for (const locale of ['en', 'zh-CN']) {
    const block = manifest.i18n[locale];
    if (!isRecord(block)) {
      addError(
        errors,
        prefix,
        `manifest.i18n.${locale} is required`,
        `add manifest.i18n.${locale}.name and description`,
      );
      continue;
    }
    if (typeof block.name !== 'string' || !block.name.trim()) {
      addError(
        errors,
        prefix,
        `manifest.i18n.${locale}.name is missing`,
        'add a localized Marketplace display name',
      );
    }
    if (typeof block.description !== 'string' || !block.description.trim()) {
      addError(
        errors,
        prefix,
        `manifest.i18n.${locale}.description is missing`,
        'add a localized Marketplace description',
      );
    }
  }
}

async function checkPluginI18nFiles(moduleDir, errors, prefix) {
  const legacySingleFile = path.join(moduleDir, 'src/i18n.ts');
  if (await exists(legacySingleFile)) {
    addError(
      errors,
      prefix,
      'legacy src/i18n.ts is not supported',
      'split plugin UI strings into src/i18n/en.ts and src/i18n/zh-CN.ts',
    );
  }

  const enPath = path.join(moduleDir, 'src/i18n/en.ts');
  const zhPath = path.join(moduleDir, 'src/i18n/zh-CN.ts');
  const enExists = await exists(enPath);
  const zhExists = await exists(zhPath);
  if (!enExists) addError(errors, prefix, 'missing src/i18n/en.ts', 'add English plugin UI strings');
  if (!zhExists)
    addError(errors, prefix, 'missing src/i18n/zh-CN.ts', 'add Simplified Chinese plugin UI strings');
  if (!enExists || !zhExists) return;

  const enKeys = await localeKeys(enPath);
  const zhKeys = await localeKeys(zhPath);
  const missing = enKeys.filter((key) => !zhKeys.includes(key));
  const extra = zhKeys.filter((key) => !enKeys.includes(key));
  if (missing.length)
    addError(
      errors,
      prefix,
      `src/i18n/zh-CN.ts is missing keys: ${missing.join(', ')}`,
      'keep locale keys in sync with en.ts',
    );
  if (extra.length)
    addError(
      errors,
      prefix,
      `src/i18n/zh-CN.ts has extra keys: ${extra.join(', ')}`,
      'remove unused keys or add them to en.ts',
    );
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
      addError(
        errors,
        prefix,
        'missing or invalid manifest.json',
        'create valid JSON with the required Marketplace manifest fields',
      );
      continue;
    }
    if (!isRecord(manifest)) {
      addError(errors, prefix, 'manifest.json must contain an object', 'make the JSON root an object');
      continue;
    }

    const id = typeof manifest.id === 'string' ? manifest.id.trim() : '';
    if (!id) addError(errors, prefix, 'manifest.id is missing', 'set it to the market-* folder name');
    else {
      if (!isKebabCaseId(id))
        addError(
          errors,
          prefix,
          `manifest.id must be kebab-case: ${id}`,
          'use lowercase letters, numbers, and single hyphens',
        );
      if (!id.startsWith('market-'))
        addError(
          errors,
          prefix,
          `manifest.id must start with "market-": ${id}`,
          'prefix Marketplace plugin IDs with market-',
        );
      if (id !== folder)
        addError(
          errors,
          prefix,
          'folder name must match manifest.id',
          'rename the folder or update manifest.id',
        );
      if (ids.has(id)) addError(errors, prefix, `duplicate manifest.id: ${id}`, 'choose a unique plugin ID');
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
      addError(
        errors,
        prefix,
        `unsupported sdkVersion: ${String(manifest.sdkVersion)}`,
        'use sdkVersion "1.0" until a newer SDK is supported',
      );
    }

    const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
    if (!permissions.length)
      addError(
        errors,
        prefix,
        'permissions must be a non-empty array',
        'declare only the SDK capabilities the plugin uses',
      );
    for (const permission of permissions) {
      if (typeof permission !== 'string' || !PERMISSIONS.has(permission)) {
        addError(
          errors,
          prefix,
          `unsupported permission: ${String(permission)}`,
          'use a supported PluginPermission from core/packages/core/src/index.ts',
        );
      }
    }

    const needsDomains = permissions.includes('http:external') || permissions.includes('http:proxy');
    const domains = Array.isArray(manifest.httpDomains) ? manifest.httpDomains : [];
    if (needsDomains && !domains.length)
      addError(
        errors,
        prefix,
        'httpDomains is required for network access',
        'add each allowed host, for example api.example.com',
      );
    for (const domain of domains) {
      if (!isHttpDomain(domain))
        addError(
          errors,
          prefix,
          `invalid httpDomain: ${String(domain)}`,
          'use hostnames only; do not include protocol, path, or broad wildcards',
        );
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
