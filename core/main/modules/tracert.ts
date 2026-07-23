import { registerStreamingCommand } from '../ipc/streaming-command';

export function register(): void {
  registerStreamingCommand({
    channel: 'tracert',
    defaultValue: 30,
    timeoutMs: 120_000,
    command: () => (process.platform === 'win32' ? 'tracert' : 'traceroute'),
    args: (host, maxHops) =>
      process.platform === 'win32' ? ['-h', String(maxHops), host] : ['-m', String(maxHops), host],
  });
}
