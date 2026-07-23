import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readOption(name, fallback) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const outputPath = path.resolve(repositoryDir, readOption('--output', 'SHA256SUMS'));
const inputs = process.argv
  .slice(2)
  .filter((arg, index, args) => !arg.startsWith('--') && args[index - 1] !== '--output');

if (inputs.length === 0) {
  process.stderr.write(
    'Usage: node scripts/generate-checksums.mjs <file-or-directory> [...] --output <file>\n',
  );
  process.exit(1);
}

const files = new Set();
function collect(inputPath) {
  const absolutePath = path.resolve(repositoryDir, inputPath);
  if (!fs.existsSync(absolutePath)) {
    process.stderr.write(`Skipping missing checksum input: ${inputPath}\n`);
    return;
  }
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) {
    if (absolutePath !== outputPath) files.add(absolutePath);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    collect(path.join(absolutePath, entry.name));
  }
}
for (const input of inputs) collect(input);

if (files.size === 0) {
  process.stderr.write('No files found for checksum generation.\n');
  process.exit(1);
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

const lines = [];
for (const filePath of [...files].sort()) {
  const relativePath = path.relative(repositoryDir, filePath).split(path.sep).join('/');
  lines.push(`${await sha256(filePath)}  ${relativePath}`);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
process.stdout.write(
  `Wrote ${lines.length} SHA-256 checksums to ${path.relative(repositoryDir, outputPath)}.\n`,
);
