import { readFile, readdir } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rendererDir = path.join(rootDir, 'core/renderer');
const nodeBuiltins = new Set(builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]));
const moduleToolSourceSoftLimit = 250;
// Renderer code should access preload APIs only through this typed facade.
const electronApiFacadePath = 'lib/electron.ts';

async function sourceFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await sourceFiles(fullPath)));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) output.push(fullPath);
  }
  return output;
}

function importSpecifiers(source) {
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g),
    (match) => match[1],
  );
}

function importsFromPrivilegedRuntime(source) {
  const specifiers = importSpecifiers(source);
  return specifiers.filter(
    (specifier) =>
      specifier === 'electron' || nodeBuiltins.has(specifier) || /(?:^|\/)main(?:\/|$)/.test(specifier),
  );
}

function relativeRendererPath(filePath) {
  return path.relative(rendererDir, filePath).split(path.sep).join('/');
}

function countOccurrences(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function countLines(source) {
  return source.split(/\r?\n/).length;
}

function isModuleToolSource(relativePath) {
  return /^components\/ModuleTools\/[^/]+\/.+\.(?:ts|tsx)$/.test(relativePath);
}

function isToolModel(relativePath) {
  return /^components\/ModuleTools\/.+\.model\.ts$/.test(relativePath);
}

function canImportElectronApiFacade(relativePath) {
  return relativePath === electronApiFacadePath || relativePath.startsWith('services/');
}

function importsElectronApiFacade(source) {
  return importSpecifiers(source).some((specifier) => specifier.includes('lib/electron'));
}

function importsFromUiOrReact(specifier) {
  return (
    specifier === 'react' ||
    specifier === 'react-dom' ||
    specifier === '@@components' ||
    specifier.startsWith('@@components/') ||
    specifier === '@devtoolbox/ui' ||
    specifier.startsWith('@devtoolbox/ui/') ||
    specifier === '@components' ||
    specifier.startsWith('@components/')
  );
}

const errors = [];
const rendererFiles = await sourceFiles(rendererDir);
for (const filePath of rendererFiles) {
  const relativePath = relativeRendererPath(filePath);
  const source = await readFile(filePath, 'utf8');
  const privilegedImports = importsFromPrivilegedRuntime(source);
  if (!privilegedImports.length) continue;
  errors.push(`${relativePath}: renderer imports privileged modules: ${privilegedImports.join(', ')}`);
}

for (const filePath of rendererFiles) {
  const relativePath = relativeRendererPath(filePath);
  if (relativePath === 'components/SafeHtml/index.tsx') continue;
  const source = await readFile(filePath, 'utf8');
  if (source.includes('dangerouslySetInnerHTML')) {
    errors.push(`${relativePath}: render HTML through components/SafeHtml`);
  }
}

for (const filePath of rendererFiles) {
  const relativePath = relativeRendererPath(filePath);
  const source = await readFile(filePath, 'utf8');
  if (!canImportElectronApiFacade(relativePath) && importsElectronApiFacade(source)) {
    errors.push(`${relativePath}: import renderer services instead of ${electronApiFacadePath}`);
  }
  const electronApiCalls = countOccurrences(source, /\bwindow\.electronAPI\b/g);
  const allowedCalls = relativePath === electronApiFacadePath ? 1 : 0;
  if (electronApiCalls > allowedCalls) {
    errors.push(
      `${relativePath}: direct window.electronAPI calls are restricted to ${electronApiFacadePath}`,
    );
  }

  if (isModuleToolSource(relativePath)) {
    const lines = countLines(source);
    if (lines > moduleToolSourceSoftLimit) {
      errors.push(`${relativePath}: module tool source has ${lines} lines; split into model/hooks/panels`);
    }
  }

  if (isToolModel(relativePath)) {
    const specifiers = Array.from(
      source.matchAll(/(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g),
      (match) => match[1],
    );
    const uiImports = specifiers.filter(importsFromUiOrReact);
    if (uiImports.length) {
      errors.push(
        `${relativePath}: model files must not import React or UI modules: ${uiImports.join(', ')}`,
      );
    }
    if (/\bwindow\./.test(source)) {
      errors.push(`${relativePath}: model files must remain pure and must not access window.* APIs`);
    }
  }
}

const coreContractSource = await readFile(path.join(rootDir, 'core/packages/core/src/index.ts'), 'utf8');
const coreContractImports = importsFromPrivilegedRuntime(coreContractSource);
if (/\bReact\./.test(coreContractSource) || /from\s+['"]react['"]/.test(coreContractSource)) {
  errors.push('core/packages/core must remain framework-neutral');
}
if (coreContractImports.length) {
  errors.push(`core/packages/core imports privileged modules: ${coreContractImports.join(', ')}`);
}

const preloadSource = await readFile(path.join(rootDir, 'core/main/preload/index.ts'), 'utf8');
for (const [api, pattern] of [
  ['ipcRenderer.invoke', /\bipcRenderer\.invoke\b/g],
  ['ipcRenderer.send', /\bipcRenderer\.send\b/g],
  ['ipcRenderer.on', /\bipcRenderer\.on\b/g],
  ['ipcRenderer.removeListener', /\bipcRenderer\.removeListener\b/g],
]) {
  const occurrences = countOccurrences(preloadSource, pattern);
  if (occurrences > 1) {
    errors.push(`core/main/preload/index.ts: use typed preload helpers instead of raw ${api} calls`);
  }
}

if (errors.length) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Architecture boundary validation passed.\n');
}
