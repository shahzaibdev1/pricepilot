'use client';
import { useSyncExternalStore } from 'react';
import WorkspaceApp from '@/components/workspace-app';
import { sampleWorkspace } from '@/lib/domain/sample';
const subscribe = () => () => {};
export default function Demo() {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return ready ? (
    <WorkspaceApp initial={sampleWorkspace()} demo />
  ) : (
    <main className="loading-page">Loading your demo workspace…</main>
  );
}
