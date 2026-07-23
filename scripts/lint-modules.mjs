import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

function isKebabCaseId(id) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getCategoryIds() {
  const placeholderPath = path.join(rootDir, 'core/renderer/data/placeholder.ts');
  const raw = await readFile(placeholderPath, 'utf8');
  return new Set(Array.from(raw.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*icon:/g), (m) => m[1]));
}

async function checkModule(moduleDir, folderName, categoryIds) {
  const errors = [];
  const manifestPath = path.join(moduleDir, 'manifest.json');
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Invalid manifest.json' : 'Missing manifest.json';
    return { folderName, errors: [message] };
  }

  if (!isRecord(manifest)) return { folderName, errors: ['manifest.json must contain an object'] };

  const id = typeof manifest.id === 'string' ? manifest.id.trim() : '';
  const categoryId = typeof manifest.categoryId === 'string' ? manifest.categoryId.trim() : '';
  const entry = typeof manifest.entry === 'string' ? manifest.entry.trim().replace(/^\.\/+/, '') : '';

  if (!id) errors.push('manifest is missing `id`');
  else {
    if (!isKebabCaseId(id)) errors.push(`id must be kebab-case: ${id}`);
    if (!id.startsWith('core-')) errors.push(`id must start with "core-": ${id}`);
  }
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) errors.push('manifest is missing `name`');
  if (typeof manifest.description !== 'string') errors.push('manifest is missing `description`');
  if (manifest.sdkVersion !== 'core') errors.push('manifest `sdkVersion` must be "core"');
  if (!categoryId) errors.push('manifest is missing `categoryId`');
  else if (!categoryIds.has(categoryId)) errors.push(`unknown categoryId: ${categoryId}`);
  if (!entry) errors.push('manifest is missing `entry`');
  if (!Array.isArray(manifest.permissions)) errors.push('manifest `permissions` must be an array');

  if (entry) {
    const entryPath = path.resolve(moduleDir, entry);
    if (!entryPath.startsWith(`${path.resolve(moduleDir)}${path.sep}`))
      errors.push('entry must stay inside the module folder');
    else if (!(await exists(entryPath))) errors.push(`entry does not exist: ${entry}`);
  }

  const localePath = path.join(moduleDir, 'locales/en.ts');
  if (!(await exists(localePath))) errors.push('Missing locales/en.ts');

  return { folderName, id, errors };
}

async function main() {
  const toolBase = path.join(rootDir, 'core/renderer/components/ModuleTools');
  const folders = (await readdir(toolBase, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const categoryIds = await getCategoryIds();
  const idMap = new Map();
  const allErrors = [];

  for (const folderName of folders) {
    const result = await checkModule(path.join(toolBase, folderName), folderName, categoryIds);
    if (result.id) {
      const previous = idMap.get(result.id);
      if (previous) allErrors.push(`Duplicate id: ${result.id} (${previous} and ${folderName})`);
      else idMap.set(result.id, folderName);
    }
    for (const error of result.errors) allErrors.push(`ModuleTools/${folderName}: ${error}`);
  }

  if (allErrors.length) {
    process.stderr.write(`${allErrors.map((error) => `- ${error}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Module validation passed (${folders.length} modules).\n`);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});
