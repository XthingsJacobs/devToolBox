type ColorToken = { name: string; hex: string };

const COLOR_TOKENS: ColorToken[] = [
  { name: 'Color/Bg/Primary', hex: '#282C34' },
  { name: 'Color/Bg/Sidebar', hex: '#21252B' },
  { name: 'Color/Bg/Panel', hex: '#21252B' },
  { name: 'Color/Bg/Content', hex: '#2C313A' },
  { name: 'Color/Bg/Hover', hex: '#FFFFFF0F' },
  { name: 'Color/Bg/Active', hex: '#FFFFFF1A' },
  { name: 'Color/Text/Primary', hex: '#ABB2BF' },
  { name: 'Color/Text/Secondary', hex: '#ABB2BFAE' },
  { name: 'Color/Text/Active', hex: '#E6E6E6' },
  { name: 'Color/Accent/Primary', hex: '#61AFEF' },
  { name: 'Color/Accent/Weak', hex: '#61AFEF40' },
  { name: 'Color/Border/Default', hex: '#FFFFFF14' },
  { name: 'Color/Border/Focus', hex: '#61AFEFE6' },
  { name: 'Color/Status/Error', hex: '#E74C3C' },
  { name: 'Color/Status/Success', hex: '#50C878' },
  { name: 'Color/Status/Info', hex: '#4AA3FF' },
  { name: 'Color/Status/Warning', hex: '#F5C542' },
];

type TextToken = { name: string; family: string; style: string; size: number; lineHeightPercent: number; fontWeight?: number };

const TEXT_TOKENS: TextToken[] = [
  { name: 'Text/Title', family: 'Inter', style: 'Semi Bold', size: 18, lineHeightPercent: 140 },
  { name: 'Text/Heading', family: 'Inter', style: 'Semi Bold', size: 15, lineHeightPercent: 140 },
  { name: 'Text/Body', family: 'Inter', style: 'Regular', size: 13, lineHeightPercent: 155 },
  { name: 'Text/Small', family: 'Inter', style: 'Regular', size: 12, lineHeightPercent: 155 },
  { name: 'Text/XS', family: 'Inter', style: 'Regular', size: 11, lineHeightPercent: 155 },
  { name: 'Text/Mono/Body', family: 'Roboto Mono', style: 'Regular', size: 12, lineHeightPercent: 155 },
];

const PAGES = ['0 Cover', '1 Tokens', '2 Components', '3 Templates', '4 Archive'] as const;

function postLog(text: string) {
  figma.ui.postMessage({ type: 'log', text });
}

function hexToRgb(hex: string): RGB {
  const raw = hex.replace('#', '');
  const v = raw.length === 8 ? raw.slice(0, 6) : raw;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return { r: r / 255, g: g / 255, b: b / 255 };
}

function hexToPaint(hex: string): SolidPaint {
  const raw = hex.replace('#', '');
  const hasAlpha = raw.length === 8;
  const alpha = hasAlpha ? parseInt(raw.slice(6, 8), 16) / 255 : 1;
  return { type: 'SOLID', color: hexToRgb(hex), opacity: alpha };
}

function getOrCreatePage(name: string): PageNode {
  const found = figma.root.children.find((p) => p.type === 'PAGE' && p.name === name);
  if (found && found.type === 'PAGE') return found;
  const p = figma.createPage();
  p.name = name;
  return p;
}

function ensurePages(): Record<(typeof PAGES)[number], PageNode> {
  const out = {} as Record<(typeof PAGES)[number], PageNode>;
  for (const name of PAGES) out[name] = getOrCreatePage(name);
  return out;
}

function getOrCreatePaintStyle(name: string): PaintStyle {
  const existing = figma.getLocalPaintStyles().find((s) => s.name === name);
  if (existing) return existing;
  const s = figma.createPaintStyle();
  s.name = name;
  return s;
}

async function loadFontSafe(family: string, style: string): Promise<FontName> {
  const fontName: FontName = { family, style };
  try {
    await figma.loadFontAsync(fontName);
    return fontName;
  } catch {
    const fallback: FontName = { family: 'Inter', style: 'Regular' };
    await figma.loadFontAsync(fallback);
    return fallback;
  }
}

function getOrCreateTextStyle(token: TextToken): TextStyle {
  const existing = figma.getLocalTextStyles().find((s) => s.name === token.name);
  if (existing) return existing;
  const s = figma.createTextStyle();
  s.name = token.name;
  return s;
}

async function upsertTextStyles() {
  postLog('更新 Text Styles…');
  for (const t of TEXT_TOKENS) {
    const s = getOrCreateTextStyle(t);
    const fontName = await loadFontSafe(t.family, t.style);
    s.fontName = fontName;
    s.fontSize = t.size;
    s.lineHeight = { unit: 'PERCENT', value: t.lineHeightPercent };
  }
}

function upsertPaintStyles() {
  postLog('更新 Color Styles…');
  for (const t of COLOR_TOKENS) {
    const s = getOrCreatePaintStyle(t.name);
    s.paints = [hexToPaint(t.hex)];
  }
}

function findOrCreateSection(page: PageNode, name: string, x: number, y: number): FrameNode {
  const existing = page.findOne((n) => n.type === 'FRAME' && n.name === name);
  if (existing && existing.type === 'FRAME') return existing;
  const f = figma.createFrame();
  f.name = name;
  f.resize(1440, 900);
  f.x = x;
  f.y = y;
  f.fills = [];
  page.appendChild(f);
  return f;
}

async function setFrameTitle(frame: FrameNode, title: string) {
  const existing = frame.findOne((n) => n.type === 'TEXT' && n.name === '__title__');
  let t: TextNode;
  if (existing && existing.type === 'TEXT') {
    t = existing;
  } else {
    t = figma.createText();
    t.name = '__title__';
    t.x = 24;
    t.y = 20;
    frame.appendChild(t);
  }
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  t.fontName = { family: 'Inter', style: 'Semi Bold' };
  t.fontSize = 22;
  t.fills = [hexToPaint('#E6E6E6')];
  t.characters = title;
}

async function buildTokensPage(page: PageNode) {
  postLog('生成 Tokens 页面结构…');
  const f = findOrCreateSection(page, 'Tokens', 0, 0);
  f.fills = [hexToPaint('#2C313A')];
  await setFrameTitle(f, 'Tokens');
}

async function buildComponentsPage(page: PageNode) {
  postLog('生成 Components 页面结构…');
  const f = findOrCreateSection(page, 'Components', 0, 0);
  f.fills = [hexToPaint('#2C313A')];
  await setFrameTitle(f, 'Components');
}

async function buildTemplatesPage(page: PageNode) {
  postLog('生成 Templates 页面结构…');
  const f = findOrCreateSection(page, 'Templates', 0, 0);
  f.fills = [hexToPaint('#2C313A')];
  await setFrameTitle(f, 'Templates');
}

async function buildCoverPage(page: PageNode) {
  postLog('生成 Cover 页面结构…');
  const f = findOrCreateSection(page, 'Cover', 0, 0);
  f.fills = [hexToPaint('#282C34')];
  await setFrameTitle(f, 'DevToolBox UI Kit');
}

async function buildArchivePage(page: PageNode) {
  postLog('生成 Archive 页面结构…');
  const f = findOrCreateSection(page, 'Archive', 0, 0);
  f.fills = [hexToPaint('#2C313A')];
  await setFrameTitle(f, 'Archive');
}

async function generateAll() {
  const pages = ensurePages();
  figma.currentPage = pages['1 Tokens'];
  upsertPaintStyles();
  await upsertTextStyles();
  await buildCoverPage(pages['0 Cover']);
  await buildTokensPage(pages['1 Tokens']);
  await buildComponentsPage(pages['2 Components']);
  await buildTemplatesPage(pages['3 Templates']);
  await buildArchivePage(pages['4 Archive']);
  figma.currentPage = pages['1 Tokens'];
}

figma.showUI(__html__, { width: 320, height: 420 });

figma.ui.onmessage = async (msg: unknown) => {
  const m = msg as { type?: string };
  if (m?.type === 'close') {
    figma.closePlugin();
    return;
  }
  if (m?.type !== 'generate') return;
  try {
    await generateAll();
    figma.ui.postMessage({ type: 'done' });
  } catch (e) {
    figma.ui.postMessage({ type: 'error', text: e instanceof Error ? e.message : String(e) });
  }
};
