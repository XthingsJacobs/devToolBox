import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const hoistedDir = path.join(rootDir, 'node_modules', '.pnpm', 'node_modules');

function walk(dir, broken) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        fs.statSync(fullPath);
      } catch (err) {
        if (err && err.code === 'ENOENT') {
          broken.push(fullPath);
        } else {
          throw err;
        }
      }
      continue;
    }

    if (entry.isDirectory()) {
      walk(fullPath, broken);
    }
  }
}

if (!fs.existsSync(hoistedDir)) {
  console.log('No pnpm hoisted node_modules directory found.');
  process.exit(0);
}

const broken = [];
walk(hoistedDir, broken);

for (const linkPath of broken) {
  fs.unlinkSync(linkPath);
}

if (broken.length === 0) {
  console.log('No broken pnpm hoisted symlinks found.');
} else {
  console.log(`Pruned broken pnpm hoisted symlinks: ${broken.length}`);
}
