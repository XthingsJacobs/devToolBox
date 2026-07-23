import { ipcMain, type IpcMainEvent } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

type StreamingCommandOptions = {
  channel: string;
  defaultValue: number;
  timeoutMs: number;
  command: () => string;
  args: (host: string, value: number) => string[];
};

export function registerStreamingCommand(options: StreamingCommandOptions): void {
  let child: ChildProcessWithoutNullStreams | null = null;

  ipcMain.on(
    `${options.channel}:start`,
    (event: IpcMainEvent, host: string, value = options.defaultValue) => {
      const safeHost = String(host ?? '').replace(/[^a-zA-Z0-9.\-:]/g, '');
      if (!safeHost) {
        event.sender.send(`${options.channel}:error`, 'Invalid host');
        event.sender.send(`${options.channel}:done`);
        return;
      }

      child?.kill();
      const nextChild = spawn(options.command(), options.args(safeHost, value));
      child = nextChild;
      const timer = setTimeout(() => nextChild.kill(), options.timeoutMs);
      let finished = false;

      const finish = (error?: string) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (child === nextChild) child = null;
        if (error) event.sender.send(`${options.channel}:error`, error);
        event.sender.send(`${options.channel}:done`);
      };

      nextChild.stdout.on('data', (data: Buffer) =>
        event.sender.send(`${options.channel}:data`, data.toString()),
      );
      nextChild.stderr.on('data', (data: Buffer) =>
        event.sender.send(`${options.channel}:data`, data.toString()),
      );
      nextChild.on('close', () => finish());
      nextChild.on('error', (error: Error) => finish(error.message));
    },
  );

  ipcMain.on(`${options.channel}:stop`, () => {
    child?.kill();
    child = null;
  });
}
