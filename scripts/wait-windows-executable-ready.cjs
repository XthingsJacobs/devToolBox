const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SETTLE_MS = 4000;
const DEFAULT_TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canOpenForWrite(filePath) {
  let handle;
  try {
    handle = await fs.open(filePath, 'r+');
    return true;
  } catch {
    return false;
  } finally {
    if (handle) await handle.close();
  }
}

exports.default = async function waitWindowsExecutableReady(context) {
  if (context.electronPlatformName !== 'win32') return;

  const productFilename = context.packager?.appInfo?.productFilename || 'DevToolBox';
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await canOpenForWrite(exePath)) {
      await sleep(DEFAULT_SETTLE_MS);
      return;
    }
    await sleep(500);
  }
};
