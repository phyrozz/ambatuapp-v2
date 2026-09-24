import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const cap = process.platform === 'win32' ? 'cap.cmd' : 'cap';
for (const [command, args, env] of [
  [npm, ['run', 'build'], { ...process.env, NATIVE_BUILD: '1' }],
  [cap, ['sync'], process.env],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
