import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';

const repositoryDir = process.cwd();
const preloadPath = path.join(repositoryDir, 'dist-electron', 'preload', 'index.js');
const rendererPath = path.join(repositoryDir, 'dist', 'index.html');

for (const requiredPath of [preloadPath, rendererPath]) {
  if (!fs.existsSync(requiredPath)) {
    process.stderr.write(`Renderer smoke test requires a production build: missing ${requiredPath}\n`);
    process.exit(1);
  }
}

const rendererHtml = fs.readFileSync(rendererPath, 'utf8');
const rendererCsp = rendererHtml.match(
  /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i,
)?.[1];
if (
  !rendererCsp ||
  rendererCsp.includes('__DEVTOOLBOX_RENDERER_CSP__') ||
  rendererCsp.includes("'unsafe-eval'") ||
  !rendererCsp.includes("script-src 'self'") ||
  !rendererCsp.includes("object-src 'none'")
) {
  process.stderr.write('Renderer smoke test requires the hardened production content security policy.\n');
  process.exit(1);
}

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-renderer-smoke-'));
app.setPath('userData', userDataDir);
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('log-level', '3');
if (process.env.CI) app.commandLine.appendSwitch('no-sandbox');

let localeSetting = 'en';
let themeSetting = 'dark';
let rendererHealthy = false;

ipcMain.handle('app:getLocale', () => ({ setting: localeSetting, locale: 'en' }));
ipcMain.handle('app:setLocale', (_event, setting) => {
  localeSetting = setting;
});
ipcMain.handle('app:getTheme', () => ({ setting: themeSetting, theme: 'dark' }));
ipcMain.handle('app:setTheme', (_event, setting) => {
  themeSetting = setting;
});
ipcMain.handle('app:getInfo', () => ({
  name: 'DevToolBox',
  company: 'DevToolBox',
  version: '0.0.0-smoke',
  build: 'smoke',
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
}));
ipcMain.handle('network:getInfo', () => ({
  localIPs: ['127.0.0.1'],
  publicIP: 'offline-smoke',
  dnsStatus: 'mocked',
  internetStatus: 'mocked',
}));
ipcMain.handle('marketplace:listInstalled', () => []);
ipcMain.handle('marketplace:fetchRegistry', () => ({
  success: true,
  registry: { schemaVersion: 1, generatedAt: new Date(0).toISOString(), plugins: [] },
}));
ipcMain.handle('diagnostics:record', () => true);
ipcMain.handle('diagnostics:list', () => ({
  events: [
    {
      id: 'renderer-smoke-event',
      timestamp: new Date(0).toISOString(),
      level: 'info',
      source: 'renderer',
      scope: 'smoke',
      message: 'Smoke diagnostic event',
    },
  ],
  droppedCount: 0,
  maxEvents: 500,
  maxBytes: 512 * 1024,
}));
ipcMain.handle('diagnostics:clear', () => true);
ipcMain.handle('startup:getStatus', () => ({
  safeMode: true,
  reason: 'crash-loop',
  consecutiveFailures: 2,
  failureThreshold: 2,
  startedAt: new Date(0).toISOString(),
}));
ipcMain.handle('startup:rendererReady', () => {
  rendererHealthy = true;
  return true;
});
ipcMain.handle('startup:restart', () => true);

const deadline = setTimeout(() => {
  process.stderr.write('Renderer smoke test timed out.\n');
  app.exit(1);
}, 90_000);

function formatFailure(error) {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

app.whenReady().then(async () => {
  const runtimeErrors = [];
  let window;
  try {
    window = new BrowserWindow({
      show: false,
      width: 1280,
      height: 900,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: preloadPath,
      },
    });

    window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level < 3 || message.includes('Electron Security Warning')) return;
      runtimeErrors.push(`console: ${message} (${sourceId}:${line})`);
    });
    window.webContents.on('render-process-gone', (_event, details) => {
      runtimeErrors.push(`renderer exited: ${details.reason} (${details.exitCode})`);
    });
    window.webContents.on('preload-error', (_event, preload, error) => {
      runtimeErrors.push(`preload failed: ${preload}: ${formatFailure(error)}`);
    });

    await window.loadFile(rendererPath);
    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const normalize = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const bodyText = () => normalize(document.body.textContent);
        window.addEventListener('error', (event) => {
          console.error('renderer-smoke uncaught error:', event.error?.stack ?? event.message);
        });
        window.addEventListener('unhandledrejection', (event) => {
          console.error('renderer-smoke unhandled rejection:', event.reason?.stack ?? event.reason);
        });
        const waitFor = async (predicate, label, timeout = 15000) => {
          const started = Date.now();
          while (Date.now() - started < timeout) {
            const value = predicate();
            if (value) return value;
            await sleep(50);
          }
          const text = bodyText();
          throw new Error(
            'Timed out waiting for ' +
              label +
              '. Body start: ' +
              text.slice(0, 400) +
              '. Body end: ' +
              text.slice(-800),
          );
        };
        const buttons = () => Array.from(document.querySelectorAll('button'));
        const enabledButton = (label, exact = true) =>
          buttons().find((button) => {
            if (button.disabled) return false;
            const text = normalize(button.textContent);
            const title = normalize(button.getAttribute('title'));
            return exact ? text === label || title === label : text.includes(label) || title.includes(label);
          });
        const clickButton = async (label, exact = true) => {
          const button = await waitFor(() => enabledButton(label, exact), 'button ' + label);
          button.click();
        };
        const clickAction = async (label) => {
          let button = enabledButton(label);
          if (!button) {
            const more = enabledButton('More');
            if (more) more.click();
            button = await waitFor(() => enabledButton(label), 'action ' + label);
          }
          button.click();
        };
        const setNativeValue = (element, value) => {
          const prototype = element instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : element instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (!setter) throw new Error('Native value setter is unavailable');
          setter.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        };

        await waitFor(
          () =>
            bodyText().includes('Dashboard') &&
            bodyText().includes('Safe mode is active') &&
            document.querySelector('input[placeholder^="Search tools"]'),
          'dashboard in safe mode',
        );
        const dashboardLabel = Array.from(document.querySelectorAll('main span,main div')).find(
          (element) =>
            normalize(element.textContent) === 'Dashboard' &&
            element.childElementCount === 0 &&
            !element.closest('button'),
        );
        if (!dashboardLabel) throw new Error('Dashboard label is unavailable for selection test');
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(dashboardLabel);
        selection.removeAllRanges();
        selection.addRange(range);
        const selectedText = normalize(selection.toString());
        const dashboardUserSelect = getComputedStyle(dashboardLabel).userSelect;
        const selectable = dashboardUserSelect !== 'none' && selectedText.toLowerCase() === 'dashboard';
        selection.removeAllRanges();
        if (!selectable) {
          throw new Error(
            'Dashboard text cannot be selected: selected=' +
              JSON.stringify(selectedText) +
              ', userSelect=' +
              dashboardUserSelect,
          );
        }

        await clickButton('Settings');
        await waitFor(() => bodyText().includes('Appearance') && bodyText().includes('Theme'), 'settings page');
        await clickButton('Diagnostics');
        await waitFor(() => bodyText().includes('Smoke diagnostic event'), 'diagnostics page');
        const diagnosticsVisible = bodyText().includes('Local diagnostics');

        await clickButton('Modules');
        await waitFor(() => bodyText().includes('No installed modules'), 'modules page');

        await clickButton('Tools');
        await waitFor(() => document.querySelector('input[placeholder^="Search tools"]') && bodyText().includes('JSON Formatter'), 'tools page');

        await clickButton('JSON Formatter', false);
        const jsonInput = await waitFor(
          () => document.querySelector('textarea[placeholder="Paste JSON string here..."]'),
          'JSON formatter',
        );
        setNativeValue(jsonInput, '{"alpha":1,"nested":{"ready":true}}');
        await waitFor(() => bodyText().includes('alpha') && bodyText().includes('ready'), 'JSON output');
        jsonInput.focus();
        jsonInput.setSelectionRange(0, 10);
        if (jsonInput.selectionEnd - jsonInput.selectionStart !== 10 || getComputedStyle(jsonInput).userSelect === 'none') {
          throw new Error('JSON input text cannot be selected');
        }

        await clickButton('Markdown Preview', false);
        const markdownFrame = await waitFor(() => document.querySelector('iframe[title="Markdown Preview"]'), 'Markdown preview');
        const markdownSource = markdownFrame.getAttribute('srcdoc') ?? '';
        if (!markdownSource.includes('Content-Security-Policy') || markdownSource.includes('cdnjs.cloudflare.com')) {
          throw new Error('Markdown preview does not use the isolated offline document');
        }

        await clickButton('JS Formatter', false);
        await waitFor(() => bodyText().includes('JS Input'), 'JavaScript formatter');
        await clickAction('Obfuscate');
        const obfuscated = await waitFor(
          () =>
            Array.from(document.querySelectorAll('pre'))
              .map((node) => node.textContent ?? '')
              .find((text) => text.length > 80 && text.includes('_0x')),
          'JavaScript obfuscation worker',
          30000,
        );

        await clickButton('QR Code Generator', false);
        const qrInput = await waitFor(
          () => document.querySelector('textarea[placeholder="Enter text, URL or any content..."]'),
          'QR code generator',
        );
        const formatSelect = Array.from(document.querySelectorAll('select')).find((select) =>
          Array.from(select.options).some((option) => option.value === 'pdf417'),
        );
        if (!formatSelect) throw new Error('Barcode format selector is unavailable');
        setNativeValue(formatSelect, 'pdf417');
        setNativeValue(qrInput, 'renderer-smoke');
        const barcodeDataLength = await waitFor(
          () => {
            const image = document.querySelector('img[alt="QR Code"]');
            const length = image?.getAttribute('src')?.length ?? 0;
            return length > 100 ? length : 0;
          },
          'PDF417 lazy renderer',
          30000,
        );

        return {
          selectedText,
          obfuscatedLength: obfuscated.length,
          barcodeDataLength,
          diagnosticsVisible,
          safeModeVisible: bodyText().includes('Safe mode is active'),
          resourceCount: performance.getEntriesByType('resource').length,
        };
      })()
    `);

    const healthDeadline = Date.now() + 10_000;
    while (!rendererHealthy && Date.now() < healthDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (runtimeErrors.length > 0) throw new Error(runtimeErrors.join('\n'));
    if (!rendererHealthy) throw new Error('Renderer did not confirm startup health');
    if (
      result.selectedText.toLowerCase() !== 'dashboard' ||
      result.obfuscatedLength <= 80 ||
      result.barcodeDataLength <= 100 ||
      !result.diagnosticsVisible ||
      !result.safeModeVisible
    ) {
      throw new Error(`Unexpected renderer result: ${JSON.stringify(result)}`);
    }

    clearTimeout(deadline);
    process.stdout.write(`Electron renderer smoke test passed: ${JSON.stringify(result)}\n`);
    window.destroy();
    app.exit(0);
  } catch (error) {
    clearTimeout(deadline);
    process.stderr.write(`${formatFailure(error)}\n`);
    window?.destroy();
    app.exit(1);
  }
});

app.once('will-quit', () => {
  fs.rmSync(userDataDir, { recursive: true, force: true });
});
