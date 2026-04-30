import { ipcMain, type IpcMainEvent } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export function register(): void {
  let pingChild: ChildProcessWithoutNullStreams | null = null;

  ipcMain.on('ping:start', (event: IpcMainEvent, host: string, count = 4) => {
    const safeHost = host.replace(/[^a-zA-Z0-9.\-:]/g, '');
    if (!safeHost) {
      event.sender.send('ping:error', 'Invalid host');
      event.sender.send('ping:done');
      return;
    }
    if (pingChild) pingChild.kill();
    pingChild = null;

    const isWin = process.platform === 'win32';
    const args = isWin ? ['-n', String(count), safeHost] : ['-c', String(count), safeHost];
    const child = spawn('ping', args);
    pingChild = child;
    const timer = setTimeout(() => child.kill(), 60000);

    child.stdout.on('data', (d: Buffer) => event.sender.send('ping:data', d.toString()));
    child.stderr.on('data', (d: Buffer) => event.sender.send('ping:data', d.toString()));
    child.on('close', () => {
      clearTimeout(timer);
      pingChild = null;
      event.sender.send('ping:done');
    });
    child.on('error', (err: Error) => {
      clearTimeout(timer);
      pingChild = null;
      event.sender.send('ping:error', err.message);
      event.sender.send('ping:done');
    });
  });

  ipcMain.on('ping:stop', () => {
    if (pingChild) pingChild.kill();
    pingChild = null;
  });
}
