import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const publisher = String(argument('--publisher') ?? '').trim();
const repository = String(argument('--repository') ?? '')
  .trim()
  .replace(/\/+$/, '');
const defaultOutputDirectory = fileURLToPath(new URL('../.signing/', import.meta.url));
const outputDirectory = path.resolve(argument('--out') ?? defaultOutputDirectory);

if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(publisher)) {
  throw new Error('Usage requires --publisher <id>');
}
if (!/^https:\/\/[^\s]{1,2040}$/.test(repository)) {
  throw new Error('Usage requires --repository <https-url>');
}
if (fs.existsSync(outputDirectory) && fs.readdirSync(outputDirectory).length > 0) {
  throw new Error(`Refusing to overwrite non-empty signing directory: ${outputDirectory}`);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const privateBytes = privateKey.export({ format: 'der', type: 'pkcs8' });
const publicBytes = publicKey.export({ format: 'der', type: 'spki' });
const keyId = `sha256-${crypto.createHash('sha256').update(publicBytes).digest('hex')}`;

fs.mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
fs.writeFileSync(
  path.join(outputDirectory, 'private-key.pk8.base64'),
  `${privateBytes.toString('base64')}\n`,
  {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  },
);
fs.writeFileSync(
  path.join(outputDirectory, 'public-key.spki.base64'),
  `${publicBytes.toString('base64')}\n`,
  {
    encoding: 'utf8',
    mode: 0o644,
    flag: 'wx',
  },
);
fs.writeFileSync(
  path.join(outputDirectory, 'trusted-publisher.json'),
  `${JSON.stringify(
    {
      publisher,
      keyId,
      publicKey: publicBytes.toString('base64'),
      sourceRepositories: [repository],
    },
    null,
    2,
  )}\n`,
  { encoding: 'utf8', mode: 0o644, flag: 'wx' },
);

process.stdout.write(`Signing key generated in ${outputDirectory}\n`);
process.stdout.write(
  'Keep private-key.pk8.base64 secret and copy only trusted-publisher.json into the trust store.\n',
);
