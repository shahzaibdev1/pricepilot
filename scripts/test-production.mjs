import { spawnSync } from 'node:child_process';
import process from 'node:process';
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_SERVER: 'production' },
  windowsHide: true,
});
process.exit(result.status ?? 1);
