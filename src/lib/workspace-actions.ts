'use server';
import { serverClient } from './supabase/server';
import { workspaceSchema } from './domain/schema';
import { executeCommand } from './domain/commands';
import { ZodError } from 'zod';
export async function mutateWorkspace(input: unknown, version: number) {
  try {
    if (!Number.isSafeInteger(version) || version < 0) throw new Error('Invalid workspace version');
    const client = await serverClient();
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) throw new Error('Your session expired. Sign in again.');
    const current = await client.rpc('get_workspace');
    if (current.error) throw new Error(current.error.message);
    if (current.data.version !== version)
      throw new Error('Workspace changed in another tab. Reload before saving.');
    const next = executeCommand(workspaceSchema.parse(current.data.data), input);
    const saved = await client.rpc('save_workspace', { expected_version: version, payload: next });
    if (saved.error) throw new Error(saved.error.message);
    return {
      ok: true as const,
      workspace: workspaceSchema.parse(saved.data.data),
      version: saved.data.version as number,
    };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof ZodError
          ? (error.issues[0]?.message ?? 'Invalid input')
          : error instanceof Error
            ? error.message
            : 'Could not save. Please try again.',
    };
  }
}
