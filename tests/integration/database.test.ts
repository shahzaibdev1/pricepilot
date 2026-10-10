import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const lines = readFileSync('.env.local', 'utf8');
const env = (name: string) =>
  lines.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.replace(/^"|"$/g, '') ?? '';
const url = env('NEXT_PUBLIC_SUPABASE_URL');
const key = env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
let a: SupabaseClient, b: SupabaseClient;
let aId: string;
beforeAll(async () => {
  a = createClient(url, key, { auth: { persistSession: false } });
  b = createClient(url, key, { auth: { persistSession: false } });
  for (const c of [a, b]) {
    const r = await c.auth.signUp({
      email: `test-${crypto.randomUUID()}@example.com`,
      password: 'TestPassword123!',
    });
    if (r.error) throw r.error;
    expect(r.data.session).not.toBeNull();
  }
  aId = (await a.auth.getUser()).data.user!.id;
});
it('creates isolated workspaces and denies unauthenticated RPC', async () => {
  const r = await a.rpc('get_workspace');
  expect(r.error).toBeNull();
  expect(r.data.version).toBe(0);
  const anon = createClient(url, key, { auth: { persistSession: false } });
  expect((await anon.rpc('get_workspace')).error).not.toBeNull();
});
it('persists data and protects account A against account B', async () => {
  const r = await a.rpc('get_workspace');
  const data = { ...r.data.data, currency: 'EUR' };
  const save = await a.rpc('save_workspace', { expected_version: r.data.version, payload: data });
  expect(save.error).toBeNull();
  expect(save.data.version).toBe(r.data.version + 1);
  const other = await b.from('workspaces').select('*').eq('user_id', aId);
  expect(other.error).toBeNull();
  expect(other.data).toEqual([]);
  expect((await b.rpc('get_workspace')).data.data.currency).toBe('USD');
  expect((await a.rpc('get_workspace')).data.data.currency).toBe('EUR');
});
it('rejects stale and concurrent saves', async () => {
  const r = await a.rpc('get_workspace');
  const saves = await Promise.all([
    a.rpc('save_workspace', { expected_version: r.data.version, payload: r.data.data }),
    a.rpc('save_workspace', { expected_version: r.data.version, payload: r.data.data }),
  ]);
  expect(saves.filter((s) => !s.error)).toHaveLength(1);
  expect(saves.filter((s) => s.error)).toHaveLength(1);
  expect(saves.find((s) => s.error)?.error?.message).toMatch(/changed/i);
});
it('rejects malformed state and direct writes', async () => {
  const r = await a.rpc('get_workspace');
  expect(
    (
      await a.rpc('save_workspace', {
        expected_version: r.data.version,
        payload: { currency: 'USD' },
      })
    ).error,
  ).not.toBeNull();
  expect(
    (await a.from('workspaces').update({ version: 999 }).eq('user_id', aId)).error,
  ).not.toBeNull();
});
it('rejects invalid catalogue revision at the database boundary', async () => {
  const r = await a.rpc('get_workspace');
  expect(
    (
      await a.rpc('save_workspace', {
        expected_version: r.data.version,
        payload: { ...r.data.data, catalogVersion: -1 },
      })
    ).error,
  ).not.toBeNull();
});
