import { app, ipcMain, nativeImage } from 'electron';
import type { IncomingMessage } from 'node:http';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import * as dns from 'node:dns';
import * as os from 'node:os';

export function register(appVersion: string, buildNumber: string): void {
  // IPC: get app info
  ipcMain.handle('app:getInfo', () => {
    return {
      name: 'DevToolBox',
      company: 'Jacobs',
      version: appVersion,
      build: buildNumber,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    };
  });

  ipcMain.handle('app:getIcon', async (_event, size?: 'small' | 'normal' | 'large') => {
    try {
      const width = size === 'small' ? 16 : size === 'normal' ? 32 : 64;
      const platform = process.platform;
      if (platform === 'darwin') {
        const exeDir = path.dirname(process.execPath);
        const resourcesDir = path.resolve(exeDir, '..', 'Resources');
        const name = app.getName();
        const candidates = [
          path.join(resourcesDir, `${name}.icns`),
          path.join(resourcesDir, 'app.icns'),
          path.join(resourcesDir, 'icon.icns'),
          path.join(resourcesDir, 'electron.icns'),
        ];
        const hit = candidates.find((p) => fs.existsSync(p));
        if (hit) {
          const img = nativeImage.createFromPath(hit);
          if (!img.isEmpty()) {
            return img.resize({ width }).toDataURL();
          }
        }
        return null;
      }

      const icon = await app.getFileIcon(process.execPath, { size: size ?? 'large' });
      if (!icon || icon.isEmpty()) return null;
      return icon.resize({ width }).toDataURL();
    } catch {
      return null;
    }
  });

  // IPC: get system info
  ipcMain.handle('system:getInfo', () => {
    const cpus = os.cpus();
    return {
      platform:
        process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : process.platform,
      arch: os.arch(),
      osVersion: os.release(),
      hostname: os.hostname(),
      cpuModel: cpus.length > 0 ? cpus[0].model : 'Unknown',
      cpuCores: cpus.length,
      totalMemory: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
      freeMemory: (os.freemem() / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
      homeDir: os.homedir(),
      username: os.userInfo().username,
    };
  });

  // IPC: get network info
  ipcMain.handle('network:getInfo', async () => {
    const interfaces = os.networkInterfaces();
    const localIPs: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (!iface.internal && iface.family === 'IPv4') {
          localIPs.push(`${iface.address} (${name})`);
        }
      }
    }

    let dnsStatus = 'OK';
    try {
      await new Promise<void>((resolve, reject) => {
        dns.resolve('www.google.com', (err: NodeJS.ErrnoException | null) => (err ? reject(err) : resolve()));
      });
    } catch {
      try {
        await new Promise<void>((resolve, reject) => {
          dns.resolve('www.baidu.com', (err: NodeJS.ErrnoException | null) =>
            err ? reject(err) : resolve(),
          );
        });
      } catch {
        dnsStatus = 'Failed';
      }
    }

    let internetStatus = 'Disconnected';
    let publicIP = '-';

    const ipApis = [
      'https://api.ipify.org',
      'https://ifconfig.me/ip',
      'https://icanhazip.com',
      'https://myip.ipip.net/ip',
    ];

    for (const url of ipApis) {
      try {
        const mod = url.startsWith('https') ? https : http;
        const result = await new Promise<string>((resolve, reject) => {
          const req = mod.get(url, { timeout: 5000 }, (res: IncomingMessage) => {
            let data = '';
            res.on('data', (chunk: Buffer | string) => {
              data += chunk.toString();
            });
            res.on('end', () => resolve(data.trim()));
          });
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('timeout'));
          });
        });
        if (result && /^\d/.test(result)) {
          internetStatus = 'Connected';
          publicIP = result;
          break;
        }
      } catch {
        continue;
      }
    }

    if (internetStatus === 'Disconnected') {
      try {
        await new Promise<void>((resolve, reject) => {
          const req = https.get('https://www.baidu.com', { timeout: 5000 }, (res: IncomingMessage) => {
            res.resume();
            resolve();
          });
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('timeout'));
          });
        });
        internetStatus = 'Connected';
      } catch {
        void 0;
      }
    }

    return {
      localIPs: localIPs.length > 0 ? localIPs : ['-'],
      publicIP,
      dnsStatus,
      internetStatus,
    };
  });
}
