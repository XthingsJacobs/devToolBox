import { app, dialog, BrowserWindow, type BrowserWindow as BrowserWindowType } from 'electron';
import { autoUpdater, type UpdateDownloadedEvent, type UpdateInfo } from 'electron-updater';
import path from 'node:path';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { setIgnoredUpdateVersion, type UpdateSettings } from './ipc/updates';
import { getCurrentLocale } from './ipc/locale';

type GetWindow = () => BrowserWindow | null;

let getWindowRef: GetWindow | null = null;
let downloading = false;
let progressWin: BrowserWindowType | null = null;
let progressPercent = 0;
let activeSource: 'manual' | 'background' | null = null;
let installOnDownload = false;
let autoCheckEnabled = false;
let ignoredVersion: string | null = null;
let timer: NodeJS.Timeout | null = null;

const UPDATE_STATE_FILE = () => path.join(app.getPath('userData'), 'updater-state.json');
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function getWin(): BrowserWindow | null {
  return getWindowRef ? getWindowRef() : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function stripHtml(input: string): string {
  const withBreaks = input
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*p\b[^>]*>/gi, '');
  return withBreaks.replace(/<[^>]+>/g, '').trim();
}

function asText(v: unknown): string {
  if (typeof v === 'string') return stripHtml(v);
  if (Array.isArray(v)) {
    const parts = v
      .map((x) => {
        if (typeof x === 'string') return stripHtml(x);
        if (isRecord(x) && typeof x['note'] === 'string') return stripHtml(String(x['note']));
        if (isRecord(x) && typeof x['text'] === 'string') return stripHtml(String(x['text']));
        return '';
      })
      .filter(Boolean);
    return parts.join('\n\n');
  }
  if (isRecord(v)) {
    const note = v['note'];
    const text = v['text'];
    if (typeof note === 'string') return stripHtml(note);
    if (typeof text === 'string') return stripHtml(text);
  }
  return '';
}

function splitVersion(version: string): { base: string; build: string | null } {
  const raw = String(version || '').trim();
  const parts = raw.split('-');
  if (parts.length < 2) return { base: raw, build: null };
  const base = parts[0] || raw;
  const last = parts[parts.length - 1] || '';
  const build = /^\d{6,}$/.test(last) ? last : null;
  return { base, build };
}

function compareVersions(a: string, b: string): number {
  const pa = String(a || '').replace(/^v/i, '').split('.')[0] ? String(a || '').replace(/^v/i, '').split('.') : [];
  const pb = String(b || '').replace(/^v/i, '').split('.')[0] ? String(b || '').replace(/^v/i, '').split('.') : [];
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const na = Number.parseInt(pa[i] ?? '0', 10);
    const nb = Number.parseInt(pb[i] ?? '0', 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) break;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function isZh(): boolean {
  return getCurrentLocale() === 'zh-CN';
}

async function showMessageBox(options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
  const win = getWin();
  if (win) return dialog.showMessageBox(win, options);
  return dialog.showMessageBox(options);
}

async function readUpdateState(): Promise<{ pendingVersion?: string } | null> {
  try {
    const raw = await readFile(UPDATE_STATE_FILE(), 'utf8');
    const parsed = JSON.parse(raw) as { pendingVersion?: string };
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function writeUpdateState(state: { pendingVersion: string }): Promise<void> {
  await writeFile(UPDATE_STATE_FILE(), `${JSON.stringify(state)}\n`, 'utf8').catch(() => undefined);
}

async function clearUpdateState(): Promise<void> {
  await rm(UPDATE_STATE_FILE(), { force: true }).catch(() => undefined);
}

function buildProgressHtml(): string {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Updating</title>
<style>
  body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#1f232a;color:#e6e6e6}
  .title{font-size:14px;opacity:.9;margin-bottom:10px}
  .row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
  .stage{font-size:13px;color:#cfcfcf;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pct{font-variant-numeric:tabular-nums;font-size:13px;color:#9bbcff}
  progress{width:100%;height:10px}
  progress::-webkit-progress-bar{background:#2a2f38;border-radius:6px}
  progress::-webkit-progress-value{background:#3b82f6;border-radius:6px}
</style>
</head>
<body>
  <div class="title">Software Update</div>
  <div class="row">
    <div id="stage" class="stage">Preparing...</div>
    <div id="pct" class="pct">0%</div>
  </div>
  <progress id="bar" max="100" value="0"></progress>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function ensureProgressWindow(): BrowserWindowType {
  if (progressWin && !progressWin.isDestroyed()) return progressWin;
  const parent = getWin() || undefined;
  progressWin = new BrowserWindow({
    width: 420,
    height: 170,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    modal: Boolean(parent),
    parent,
    show: false,
    alwaysOnTop: true,
    title: 'Updating',
    backgroundColor: '#1f232a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  progressWin.on('closed', () => {
    progressWin = null;
  });
  void progressWin.loadURL(buildProgressHtml());
  progressWin.once('ready-to-show', () => {
    if (!progressWin) return;
    progressWin.show();
  });
  return progressWin;
}

function setWindowProgress(value: number): void {
  const win = getWin();
  if (!win) return;
  try {
    win.setProgressBar(value);
  } catch {
    void 0;
  }
}

function updateProgressUi(stage: string, percent?: number): void {
  const win = ensureProgressWindow();
  if (typeof percent === 'number') progressPercent = Math.max(0, Math.min(100, percent));
  const p = progressPercent;
  setWindowProgress(p <= 0 ? 0.01 : p / 100);
  const safeStage = stage.replace(/`/g, '').slice(0, 200);
  void win.webContents
    .executeJavaScript(
      `document.getElementById("stage").textContent=\`${safeStage}\`;document.getElementById("pct").textContent="${Math.round(
        p,
      )}%";document.getElementById("bar").value=${Math.round(p)};`,
      true,
    )
    .catch(() => undefined);
}

function closeProgressUi(): void {
  setWindowProgress(-1);
  progressPercent = 0;
  if (progressWin && !progressWin.isDestroyed()) {
    progressWin.close();
  }
  progressWin = null;
}

async function onUpdateAvailable(info: UpdateInfo): Promise<void> {
  const source = activeSource;
  if (!source) return;
  if (source === 'background' && !autoCheckEnabled) {
    activeSource = null;
    return;
  }
  if (downloading) return;
  if (source === 'background' && ignoredVersion && compareVersions(info.version, ignoredVersion) <= 0) {
    activeSource = null;
    return;
  }
  const { base, build } = splitVersion(info.version);
  const notes = asText(info.releaseNotes);
  const detail = [build ? `Build: ${build}` : '', notes].filter(Boolean).join('\n');
  const zh = isZh();
  const r = await showMessageBox({
    type: 'info',
    title: zh ? '发现新版本' : 'Update Available',
    message: zh ? `检测到新版本：v${base || info.version}` : `A new version is available: v${base || info.version}`,
    detail: detail ? detail.slice(0, 6000) : '',
    buttons: zh ? ['现在升级', '稍后升级', '不再提醒'] : ['Update Now', 'Later', 'Skip This Version'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (r.response === 2) {
    ignoredVersion = info.version;
    setIgnoredUpdateVersion(info.version);
    activeSource = null;
    return;
  }
  if (r.response !== 0) {
    activeSource = null;
    installOnDownload = false;
    return;
  }
  installOnDownload = true;
  downloading = true;
  progressPercent = 0;
  updateProgressUi(zh ? '正在下载更新...' : 'Downloading update...', 0);
  try {
    await autoUpdater.downloadUpdate();
  } catch (e: unknown) {
    downloading = false;
    activeSource = null;
    closeProgressUi();
    const msg = e instanceof Error ? e.message : String(e);
    await showMessageBox({
      type: 'error',
      title: zh ? '更新失败' : 'Update Error',
      message: zh ? '下载更新失败。' : 'Failed to download update.',
      detail: msg,
    });
  }
}

async function onUpdateDownloaded(info: UpdateInfo): Promise<void> {
  const source = activeSource;
  if (!source) return;
  downloading = false;
  closeProgressUi();
  const notes = asText(info.releaseNotes);
  const zh = isZh();
  if (installOnDownload) {
    activeSource = null;
    installOnDownload = false;
    await writeUpdateState({ pendingVersion: info.version });
    updateProgressUi(zh ? '正在安装...' : 'Installing...', 100);
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 200);
    return;
  }
  if (source !== 'manual') {
    activeSource = null;
    return;
  }
  const r = await showMessageBox({
    type: 'info',
    title: zh ? '已准备安装' : 'Ready to Install',
    message: zh ? `更新已下载：v${info.version}` : `Update downloaded: v${info.version}`,
    detail: notes ? notes.slice(0, 6000) : '',
    buttons: zh ? ['现在升级', '稍后升级'] : ['Install and Relaunch', 'Later'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  activeSource = null;
  if (r.response === 0) {
    await writeUpdateState({ pendingVersion: info.version });
    updateProgressUi(zh ? '正在安装...' : 'Installing...', 100);
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 200);
  }
}

async function onError(e: Error): Promise<void> {
  if (activeSource !== 'manual') {
    activeSource = null;
    downloading = false;
    closeProgressUi();
    return;
  }
  activeSource = null;
  downloading = false;
  closeProgressUi();
  const zh = isZh();
  await showMessageBox({
    type: 'error',
    title: zh ? '更新失败' : 'Update Error',
    message: zh ? '检查更新失败。' : 'Update check failed.',
    detail: e?.message ? e.message : String(e),
  });
}

function stopTimer(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

function startTimer(): void {
  stopTimer();
  timer = setInterval(() => {
    void checkForUpdatesBackground();
  }, CHECK_INTERVAL_MS);
}

export function initUpdater(getWindow: GetWindow): void {
  getWindowRef = getWindow;
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.requestHeaders = {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  };
  type UpdaterEmitter = {
    addListener(event: 'update-available', listener: (info: UpdateInfo) => void): void;
    addListener(event: 'update-not-available', listener: (info: UpdateInfo) => void): void;
    addListener(event: 'update-downloaded', listener: (event: UpdateDownloadedEvent) => void): void;
    addListener(event: 'download-progress', listener: (info: { percent?: number }) => void): void;
    addListener(event: 'error', listener: (error: Error) => void): void;
  };
  const u = autoUpdater as unknown as UpdaterEmitter;
  u.addListener('update-available', (info: UpdateInfo) => void onUpdateAvailable(info));
  u.addListener('update-not-available', (info: UpdateInfo) => {
    if (activeSource !== 'manual') {
      activeSource = null;
      return;
    }
    activeSource = null;
    const zh = isZh();
    void showMessageBox({
      type: 'info',
      title: zh ? '已是最新版本' : 'Up to Date',
      message: zh ? '你正在使用最新版本。' : 'You are using the latest version.',
      detail: zh
        ? `当前版本：v${app.getVersion()}\n服务器最新：v${info.version}`
        : `Current version: v${app.getVersion()}\nLatest from feed: v${info.version}`,
    });
  });
  u.addListener('update-downloaded', (event: UpdateDownloadedEvent) => void onUpdateDownloaded(event));
  u.addListener('download-progress', (info: { percent?: number }) => {
    if (!activeSource) return;
    if (!downloading) return;
    const p = typeof info.percent === 'number' && Number.isFinite(info.percent) ? info.percent : 0;
    updateProgressUi(isZh() ? '正在下载更新...' : 'Downloading update...', p);
  });
  u.addListener('error', (e: Error) => void onError(e));
  void readUpdateState().then(async (state) => {
    const pending = state?.pendingVersion;
    if (!pending) return;
    await clearUpdateState();
    if (pending !== app.getVersion()) return;
    await showMessageBox({
      type: 'info',
      title: 'Update Completed',
      message: 'Update installed successfully.',
      detail: `Current version: v${app.getVersion()}`,
    });
  });
}

export async function checkForUpdatesInteractive(): Promise<void> {
  if (!app.isPackaged) {
    await showMessageBox({
      type: 'info',
      title: 'Updates',
      message: 'Update check is available in packaged builds only.',
    });
    return;
  }
  if (activeSource) return;
  activeSource = 'manual';
  downloading = false;
  try {
    await autoUpdater.checkForUpdates();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await onError(new Error(msg));
  }
}

async function checkForUpdatesBackground(): Promise<void> {
  if (!app.isPackaged) return;
  if (!autoCheckEnabled) return;
  if (activeSource) return;
  if (downloading) return;
  activeSource = 'background';
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    activeSource = null;
  }
}

export function configureAutoUpdate(settings: UpdateSettings): void {
  autoCheckEnabled = Boolean(settings.autoCheck);
  ignoredVersion = settings.ignoredVersion ? String(settings.ignoredVersion) : null;
  if (!app.isPackaged) return;
  if (autoCheckEnabled) {
    startTimer();
    setTimeout(() => {
      void checkForUpdatesBackground();
    }, 1500);
  } else {
    stopTimer();
  }
}
