import { registerStreamingCommand } from '../ipc/streaming-command';

export function register(): void {
  registerStreamingCommand({
    channel: 'ping',
    defaultValue: 4,
    timeoutMs: 60_000,
    command: () => 'ping',
    args: (host, count) =>
      process.platform === 'win32' ? ['-n', String(count), host] : ['-c', String(count), host],
  });
}
