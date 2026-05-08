import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entry = path.join(__dirname, 'code.ts');
const outFile = path.join(__dirname, 'dist', 'code.js');
const htmlFile = path.join(__dirname, 'ui.html');

fs.mkdirSync(path.dirname(outFile), { recursive: true });
const html = fs.readFileSync(htmlFile, 'utf8');

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  target: 'es2018',
  outfile: outFile,
  define: { __html__: JSON.stringify(html) },
});
