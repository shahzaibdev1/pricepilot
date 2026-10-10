import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { workspaceSchema } from '@/lib/domain/schema';
import WorkspaceApp from '@/components/workspace-app';
export const dynamic = 'force-dynamic';
export default async function AppPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    redirect('/login?setup=1');
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect('/login');
  const result = await client.rpc('get_workspace');
  if (result.error) throw new Error('Could not load workspace: ' + result.error.message);
  return (
    <WorkspaceApp
      initial={workspaceSchema.parse(result.data.data)}
      initialVersion={result.data.version}
      email={user.email}
      demo={false}
    />
  );
}
