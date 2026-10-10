import { spawnSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

function cli(args) {
  return spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['supabase', ...args], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
}
if (existsSync('.env.local')) {
  const existing = readFileSync('.env.local', 'utf8');
  if (/^NEXT_PUBLIC_SUPABASE_URL=https:\/\//m.test(existing)) {
    throw new Error(
      'This checkout uses hosted Supabase. Move .env.local aside before setting up local development.',
    );
  }
}
console.log('Starting local Supabase. Docker Desktop must be running.');
const start = cli([
  'start',
  '-x',
  'studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor',
]);
if (start.status !== 0)
  throw new Error(
    'Supabase did not start. Check Docker Desktop and run npm run db:start for diagnostics.',
  );
const status = cli(['status', '-o', 'json']);
if (status.status !== 0) throw new Error('Could not read Supabase status.');
const data = JSON.parse(status.stdout);
const url = data.API_URL,
  key = data.PUBLISHABLE_KEY ?? data.ANON_KEY;
if (!url || !key) throw new Error('Local API URL or publishable key is missing.');
writeFileSync(
  '.env.local',
  `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nNEXT_PUBLIC_APP_URL=http://127.0.0.1:3000\n`,
);
console.log(
  'Local environment configured using the publishable key only. Open http://127.0.0.1:3000 after npm run dev.',
);
