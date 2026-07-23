import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(rootDir, 'docs');
const mkdocsPath = path.join(rootDir, 'docs-site/mkdocs.yml');
const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function relativeToRoot(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(fullPath)));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath);
  }
  return files.sort();
}

function markdownStructure(source) {
  const headingLevels = [];
  let fenceMarker = '';
  let fenceBlocks = 0;

  for (const line of source.split(/\r?\n/)) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      if (!fenceMarker) {
        fenceMarker = marker;
        fenceBlocks += 1;
      } else if (marker === fenceMarker) {
        fenceMarker = '';
      }
      continue;
    }
    if (fenceMarker) continue;

    const heading = line.match(/^(#{1,6})\s+/);
    if (heading) headingLevels.push(heading[1].length);
  }

  return { headingLevels, fenceBlocks, hasUnclosedFence: Boolean(fenceMarker) };
}

function markdownLinks(source) {
  const links = [];
  let fenceMarker = '';

  source.split(/\r?\n/).forEach((line, index) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      if (!fenceMarker) fenceMarker = marker;
      else if (marker === fenceMarker) fenceMarker = '';
      return;
    }
    if (fenceMarker) return;

    for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      let destination = match[1].trim();
      if (destination.startsWith('<')) {
        const closing = destination.indexOf('>');
        destination = closing === -1 ? destination : destination.slice(1, closing);
      } else {
        destination = destination.split(/\s+["']/)[0];
      }
      links.push({ destination, line: index + 1 });
    }
  });

  return links;
}

function localLinkTarget(sourcePath, destination) {
  if (!destination || destination.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(destination)) {
    return undefined;
  }

  const [rawPath, rawFragment] = destination.split('#', 2);
  let decodedPath;
  let fragment;
  try {
    decodedPath = decodeURIComponent(rawPath.split('?', 1)[0]);
    fragment = rawFragment ? decodeURIComponent(rawFragment) : '';
  } catch {
    return { error: `contains invalid URL encoding: ${destination}` };
  }

  const targetPath = path.resolve(path.dirname(sourcePath), decodedPath || path.basename(sourcePath));
  const relativePath = path.relative(rootDir, targetPath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`)) {
    return { error: `points outside the repository: ${destination}` };
  }
  return { path: targetPath, fragment };
}

function headingSlug(heading) {
  return heading
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function headingSlugs(source) {
  const slugs = new Set();
  const counts = new Map();
  let fenceMarker = '';

  for (const line of source.split(/\r?\n/)) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      if (!fenceMarker) fenceMarker = marker;
      else if (marker === fenceMarker) fenceMarker = '';
      continue;
    }
    if (fenceMarker) continue;

    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;
    const baseSlug = headingSlug(heading[1]);
    const duplicateIndex = counts.get(baseSlug) ?? 0;
    counts.set(baseSlug, duplicateIndex + 1);
    slugs.add(duplicateIndex === 0 ? baseSlug : `${baseSlug}_${duplicateIndex}`);
  }
  return slugs;
}

async function localeDirectories() {
  const directories = [];
  for (const entry of await readdir(docsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !localePattern.test(entry.name)) continue;
    if (await exists(path.join(docsDir, entry.name, 'index.md'))) directories.push(entry.name);
  }
  return directories.sort();
}

function pageLinkTargets(filePath, source, maxLine = Number.POSITIVE_INFINITY) {
  return new Set(
    markdownLinks(source)
      .filter((link) => link.line <= maxLine)
      .map((link) => localLinkTarget(filePath, link.destination))
      .filter((target) => target?.path)
      .map((target) => path.normalize(target.path)),
  );
}

async function validateLanguageSwitch(files, errors) {
  const sources = new Map();
  for (const filePath of files) sources.set(filePath, await readFile(filePath, 'utf8'));

  for (const filePath of files) {
    const targets = pageLinkTargets(filePath, sources.get(filePath), 10);
    for (const counterpartPath of files) {
      if (!targets.has(path.normalize(counterpartPath))) {
        errors.push(
          `${relativeToRoot(filePath)}: language switch must link to ${relativeToRoot(counterpartPath)}`,
        );
      }
    }
  }
}

async function validateLocalLinks(files, errors) {
  const sourceCache = new Map();
  const slugCache = new Map();

  for (const filePath of files) {
    const source = await readFile(filePath, 'utf8');
    sourceCache.set(filePath, source);

    for (const link of markdownLinks(source)) {
      const target = localLinkTarget(filePath, link.destination);
      if (!target) continue;
      if (target.error) {
        errors.push(`${relativeToRoot(filePath)}:${link.line}: ${target.error}`);
        continue;
      }
      if (!(await exists(target.path))) {
        errors.push(
          `${relativeToRoot(filePath)}:${link.line}: missing local link target ${link.destination}`,
        );
        continue;
      }

      if (!target.fragment || path.extname(target.path).toLowerCase() !== '.md') continue;
      let targetSource = sourceCache.get(target.path);
      if (targetSource === undefined) {
        targetSource = await readFile(target.path, 'utf8');
        sourceCache.set(target.path, targetSource);
      }
      let slugs = slugCache.get(target.path);
      if (!slugs) {
        slugs = headingSlugs(targetSource);
        slugCache.set(target.path, slugs);
      }
      if (!slugs.has(target.fragment)) {
        errors.push(
          `${relativeToRoot(filePath)}:${link.line}: missing heading #${target.fragment} in ${relativeToRoot(target.path)}`,
        );
      }
    }
  }
}

async function main() {
  const errors = [];
  const locales = await localeDirectories();
  if (!locales.length) errors.push('docs/: no locale directory with an index.md was found');

  const allDocsFiles = await markdownFiles(docsDir);
  const localeRoots = locales.map((locale) => `${path.join(docsDir, locale)}${path.sep}`);
  const englishPages = allDocsFiles.filter(
    (filePath) => !localeRoots.some((localeRoot) => filePath.startsWith(localeRoot)),
  );
  const englishRelativePaths = englishPages.map((filePath) => path.relative(docsDir, filePath)).sort();

  for (const locale of locales) {
    const localeDir = path.join(docsDir, locale);
    const translatedPages = (await markdownFiles(localeDir))
      .filter((filePath) => path.basename(filePath) !== 'README.md')
      .map((filePath) => path.relative(localeDir, filePath))
      .sort();

    for (const relativePath of englishRelativePaths) {
      if (!translatedPages.includes(relativePath)) {
        errors.push(`${locale}: missing translation for docs/${relativePath}`);
      }
    }
    for (const relativePath of translatedPages) {
      if (!englishRelativePaths.includes(relativePath)) {
        errors.push(`${locale}: translation has no English source: docs/${locale}/${relativePath}`);
      }
    }

    for (const relativePath of englishRelativePaths) {
      const sourcePath = path.join(docsDir, relativePath);
      const translatedPath = path.join(localeDir, relativePath);
      if (!(await exists(translatedPath))) continue;

      const sourceStructure = markdownStructure(await readFile(sourcePath, 'utf8'));
      const translatedStructure = markdownStructure(await readFile(translatedPath, 'utf8'));
      if (sourceStructure.hasUnclosedFence) errors.push(`${relativeToRoot(sourcePath)}: unclosed code fence`);
      if (translatedStructure.hasUnclosedFence)
        errors.push(`${relativeToRoot(translatedPath)}: unclosed code fence`);
      if (sourceStructure.headingLevels.join(',') !== translatedStructure.headingLevels.join(',')) {
        errors.push(`${locale}: heading hierarchy differs for ${relativePath}`);
      }
      if (sourceStructure.fenceBlocks !== translatedStructure.fenceBlocks) {
        errors.push(`${locale}: code fence count differs for ${relativePath}`);
      }
    }

    const translatedReadme = path.join(localeDir, 'README.md');
    if (await exists(translatedReadme)) {
      const readmeFiles = [path.join(rootDir, 'README.md'), translatedReadme];
      const structures = await Promise.all(
        readmeFiles.map(async (filePath) => markdownStructure(await readFile(filePath, 'utf8'))),
      );
      if (structures[0].headingLevels.join(',') !== structures[1].headingLevels.join(',')) {
        errors.push(`${locale}: repository README heading hierarchy differs from README.md`);
      }
      if (structures[0].fenceBlocks !== structures[1].fenceBlocks) {
        errors.push(`${locale}: repository README code fence count differs from README.md`);
      }
      await validateLanguageSwitch(readmeFiles, errors);
    }
  }

  for (const relativePath of englishRelativePaths) {
    const variants = [path.join(docsDir, relativePath)];
    for (const locale of locales) {
      const translatedPath = path.join(docsDir, locale, relativePath);
      if (await exists(translatedPath)) variants.push(translatedPath);
    }
    await validateLanguageSwitch(variants, errors);
  }

  const mkdocsSource = await readFile(mkdocsPath, 'utf8');
  const navSource = mkdocsSource.match(/(?:^|\n)nav:\s*\n([\s\S]*)$/)?.[1] ?? '';
  const navPages = Array.from(navSource.matchAll(/:\s+([^\s#]+\.md)\s*$/gm), (match) => match[1]);
  const expectedNavPages = [
    ...englishRelativePaths.map((relativePath) => relativePath.split(path.sep).join('/')),
    ...locales.flatMap((locale) =>
      englishRelativePaths.map((relativePath) => `${locale}/${relativePath.split(path.sep).join('/')}`),
    ),
  ].sort();
  const uniqueNavPages = [...new Set(navPages)].sort();
  for (const expectedPage of expectedNavPages) {
    if (!uniqueNavPages.includes(expectedPage))
      errors.push(`docs-site/mkdocs.yml: nav omits ${expectedPage}`);
  }
  for (const navPage of uniqueNavPages) {
    if (!expectedNavPages.includes(navPage)) {
      errors.push(`docs-site/mkdocs.yml: nav contains unexpected page ${navPage}`);
    }
  }
  if (navPages.length !== uniqueNavPages.length) {
    errors.push('docs-site/mkdocs.yml: nav contains duplicate page entries');
  }

  const excludedPages = new Set(
    Array.from(
      mkdocsSource
        .match(/exclude_docs:\s*\|\s*\n([\s\S]*?)(?=\n\S|$)/)?.[1]
        ?.matchAll(/^\s+([^#\s]+\.md)\s*$/gm) ?? [],
      (match) => match[1],
    ),
  );
  for (const locale of locales) {
    const translatedReadme = path.join(docsDir, locale, 'README.md');
    if ((await exists(translatedReadme)) && !excludedPages.has(`${locale}/README.md`)) {
      errors.push(`docs-site/mkdocs.yml: exclude_docs must include ${locale}/README.md`);
    }
  }

  const localLinkFiles = [...allDocsFiles, path.join(rootDir, 'README.md')];
  await validateLocalLinks(localLinkFiles, errors);

  if (errors.length) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Documentation validation passed (${englishPages.length} English pages, ${locales.length} locale).\n`,
  );
}

await main();
