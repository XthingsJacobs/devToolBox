import { ipcMain, type IpcMainEvent } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export function register(): void {
  let tracertChild: ChildProcessWithoutNullStreams | null = null;

  ipcMain.on('tracert:start', (event: IpcMainEvent, host: string, maxHops = 30) => {
    const safeHost = host.replace(/[^a-zA-Z0-9.\-:]/g, '');
    if (!safeHost) {
      event.sender.send('tracert:error', 'Invalid host');
      event.sender.send('tracert:done');
      return;
    }
    if (tracertChild) tracertChild.kill();
    tracertChild = null;

    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'tracert' : 'traceroute';
    const args = isWin ? ['-h', String(maxHops), safeHost] : ['-m', String(maxHops), safeHost];
    const child = spawn(cmd, args);
    tracertChild = child;
    const timer = setTimeout(() => child.kill(), 120000);

    child.stdout.on('data', (d: Buffer) => event.sender.send('tracert:data', d.toString()));
    child.stderr.on('data', (d: Buffer) => event.sender.send('tracert:data', d.toString()));
    child.on('close', () => {
      clearTimeout(timer);
      tracertChild = null;
      event.sender.send('tracert:done');
    });
    child.on('error', (err: Error) => {
      clearTimeout(timer);
      tracertChild = null;
      event.sender.send('tracert:error', err.message);
      event.sender.send('tracert:done');
    });
  });

  ipcMain.on('tracert:stop', () => {
    if (tracertChild) tracertChild.kill();
    tracertChild = null;
  });
}
