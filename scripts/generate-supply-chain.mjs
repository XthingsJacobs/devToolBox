import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repositoryDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readOption(name, fallback) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const packageDir = path.resolve(repositoryDir, readOption('--package-dir', '.'));
const outputDir = path.resolve(repositoryDir, readOption('--output-dir', 'dist/supply-chain'));
const rootManifestPath = path.join(packageDir, 'package.json');

if (!fs.existsSync(rootManifestPath)) throw new Error(`Package manifest not found: ${rootManifestPath}`);

const rootManifest = JSON.parse(fs.readFileSync(rootManifestPath, 'utf8'));
const rootName = String(rootManifest.name ?? path.basename(packageDir));
const rootVersion = String(rootManifest.version ?? '0.0.0');

function runPnpmList() {
  const npmExecPath = process.env.npm_execpath;
  const useNodeCli = npmExecPath && path.basename(npmExecPath).toLowerCase().includes('pnpm');
  const command = useNodeCli ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const args = useNodeCli
    ? [npmExecPath, 'list', '--prod', '--json', '--depth', 'Infinity']
    : ['list', '--prod', '--json', '--depth', 'Infinity'];
  const result = spawnSync(command, args, {
    cwd: packageDir,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Unable to read the production dependency tree:\n${result.stderr || result.stdout}`);
  }
  const list = JSON.parse(result.stdout);
  return Array.isArray(list)
    ? (list.find((item) => path.resolve(item.path ?? '') === packageDir) ?? list[0])
    : list;
}

function readPackageMetadata(node, nameHint) {
  const manifestPath = typeof node.path === 'string' ? path.join(node.path, 'package.json') : '';
  const manifest =
    manifestPath && fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const name = String(manifest.name ?? node.name ?? node.from ?? nameHint);
  const version = String(manifest.version ?? node.version ?? '0.0.0').replace(/^(?:link|workspace):/, '');
  const rawLicense = manifest.license ?? manifest.licenses;
  let license = 'UNKNOWN';
  if (typeof rawLicense === 'string' && rawLicense.trim()) license = rawLicense.trim();
  else if (rawLicense && typeof rawLicense.type === 'string') license = rawLicense.type;
  else if (Array.isArray(rawLicense)) {
    const values = rawLicense
      .map((item) => (typeof item === 'string' ? item : item?.type))
      .filter((item) => typeof item === 'string' && item.trim());
    if (values.length > 0) license = values.join(' OR ');
  }
  return {
    name,
    version,
    license,
    path: typeof node.path === 'string' ? path.resolve(node.path) : '',
    homepage: typeof manifest.homepage === 'string' ? manifest.homepage : '',
    resolved: typeof node.resolved === 'string' ? node.resolved : '',
  };
}

function purl(name, version) {
  const encodedName = name.startsWith('@')
    ? `%40${name.slice(1).split('/').map(encodeURIComponent).join('/')}`
    : encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

function dependencyEntries(node) {
  return Object.entries(node?.dependencies ?? {}).sort(([left], [right]) => left.localeCompare(right));
}

const rootRef = purl(rootName, rootVersion);
const components = new Map();
const dependencyGraph = new Map([[rootRef, new Set()]]);
const expanded = new Set();

function visitDependency(node, nameHint, parentRef) {
  const metadata = readPackageMetadata(node, nameHint);
  const ref = purl(metadata.name, metadata.version);
  dependencyGraph.get(parentRef)?.add(ref);
  if (!components.has(ref)) {
    const component = {
      type: 'library',
      'bom-ref': ref,
      name: metadata.name,
      version: metadata.version,
      scope: 'required',
      licenses: [{ expression: metadata.license }],
      purl: ref,
    };
    const reference = metadata.homepage || metadata.resolved;
    if (reference)
      component.externalReferences = [
        { type: metadata.homepage ? 'website' : 'distribution', url: reference },
      ];
    components.set(ref, { component, metadata });
  }
  if (!dependencyGraph.has(ref)) dependencyGraph.set(ref, new Set());

  const expansionKey = `${ref}\0${metadata.path}`;
  if (expanded.has(expansionKey)) return;
  expanded.add(expansionKey);
  for (const [dependencyName, dependency] of dependencyEntries(node)) {
    visitDependency(dependency, dependencyName, ref);
  }
}

const declaredRuntimeDependencies = {
  ...(rootManifest.dependencies ?? {}),
  ...(rootManifest.optionalDependencies ?? {}),
};
if (Object.keys(declaredRuntimeDependencies).length > 0) {
  const dependencyTree = runPnpmList();
  for (const [dependencyName, dependency] of dependencyEntries(dependencyTree)) {
    visitDependency(dependency, dependencyName, rootRef);
  }
}

const sortedComponents = [...components.values()].sort((left, right) =>
  left.component['bom-ref'].localeCompare(right.component['bom-ref']),
);
const thirdParty = sortedComponents.filter(({ metadata }) => {
  if (metadata.name.startsWith('@devtoolbox/')) return false;
  return !metadata.path.startsWith(`${path.join(repositoryDir, 'core', 'packages')}${path.sep}`);
});

const policyErrors = [];
for (const { metadata } of thirdParty) {
  if (metadata.license === 'UNKNOWN')
    policyErrors.push(`${metadata.name}@${metadata.version} has no declared license`);
  if (/(^|[ (])(?:AGPL|GPL|SSPL)-/i.test(metadata.license)) {
    policyErrors.push(`${metadata.name}@${metadata.version} uses disallowed license ${metadata.license}`);
  }
}
if (policyErrors.length > 0) {
  process.stderr.write(`License policy failed:\n- ${policyErrors.join('\n- ')}\n`);
  process.exit(1);
}

const rootLicense = typeof rootManifest.license === 'string' ? rootManifest.license : 'UNKNOWN';
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: 'DevToolBox', name: 'generate-supply-chain.mjs' }],
    component: {
      type: rootManifest.private ? 'application' : 'library',
      'bom-ref': rootRef,
      name: rootName,
      version: rootVersion,
      licenses: [{ expression: rootLicense }],
      purl: rootRef,
    },
  },
  components: sortedComponents.map(({ component }) => component),
  dependencies: [...dependencyGraph.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ref, dependencies]) => ({ ref, dependsOn: [...dependencies].sort() })),
};

function escapeMarkdown(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

const noticeRows = thirdParty.map(({ metadata }) => {
  const project = metadata.homepage ? `[Project](${metadata.homepage})` : '';
  return `| ${escapeMarkdown(metadata.name)} | ${escapeMarkdown(metadata.version)} | ${escapeMarkdown(metadata.license)} | ${project} |`;
});
const notices = `# Third-Party Notices

Generated for ${rootName} ${rootVersion}. This inventory covers installed production dependencies; optional peer dependencies and development-only tooling are not bundled.

| Package | Version | License | Project |
| --- | --- | --- | --- |
${noticeRows.length > 0 ? noticeRows.join('\n') : '| None | - | - | - |'}
`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'sbom.cdx.json'), `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(outputDir, 'THIRD_PARTY_NOTICES.md'), notices, 'utf8');

process.stdout.write(
  `Wrote CycloneDX SBOM and notices for ${sortedComponents.length} production components (${thirdParty.length} third-party).\n`,
);
