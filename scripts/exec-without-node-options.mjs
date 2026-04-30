import { spawn } from 'node:child_process';

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) process.exit(1);

const env = { ...process.env, NODE_OPTIONS: '' };
const child = spawn(cmd, args, { stdio: 'inherit', shell: true, env });
child.on('exit', (code) => process.exit(code ?? 1));
