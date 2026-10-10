'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Layers,
  LayoutDashboard,
  Truck,
  Package,
  History,
  Plus,
  ArrowUpRight,
  ArrowRight,
  LogOut,
  CheckCircle2,
  FileSpreadsheet,
  ShieldCheck,
  Clock3,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { Workspace, Batch } from '@/lib/domain/types';
import { workspaceSchema, type Command } from '@/lib/domain/schema';
import { executeCommand } from '@/lib/domain/commands';
import { mutateWorkspace } from '@/lib/workspace-actions';
import { browserClient } from '@/lib/supabase/browser';
import Suppliers from './suppliers';
import Catalogue from './catalogue';
import UploadFlow from './upload-flow';
import Review from './review';
import { Empty, dateLabel } from './shared';
type View =
  'dashboard' | 'suppliers' | 'catalogue' | 'history' | 'upload' | 'catalogue-import' | 'review';
const STORAGE_KEY = 'pricepilot-workspace-v1';
function loadLocal(initial: Workspace, version: number) {
  if (typeof window === 'undefined') return { workspace: initial, version };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { workspace: initial, version };
    const saved = JSON.parse(raw);
    if (!Number.isSafeInteger(saved.version) || saved.version < 0) throw new Error();
    return { workspace: workspaceSchema.parse(saved.workspace), version: saved.version as number };
  } catch {
    return {
      workspace: initial,
      version,
      error:
        'Your saved demo could not be read. This session uses sample data; clear demo data to start fresh.',
    };
  }
}
function UpdateTable({
  batches,
  onOpen,
  onDelete,
  busy = false,
}: {
  batches: Batch[];
  onOpen: (id: string) => void;
  onDelete?: (batch: Batch) => void;
  busy?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Supplier / file</th>
            <th scope="col">Date</th>
            <th scope="col">Products</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Update actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id}>
              <td>
                <strong>{b.supplierName}</strong>
                <span className="sku">{b.fileName}</span>
              </td>
              <td className="muted">{dateLabel(b.createdAt)}</td>
              <td>{b.rows.length}</td>
              <td>
                <span className={`badge ${b.status === 'applied' ? 'good' : 'neutral'}`}>
                  {b.status === 'applied' ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}{' '}
                  {b.status === 'applied' ? 'Applied' : 'Needs review'}
                </span>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Open ${b.fileName}`}
                  disabled={busy}
                  onClick={() => onOpen(b.id)}
                >
                  <ArrowUpRight size={18} />
                </button>
                {onDelete && (
                  <button
                    className="icon-button"
                    aria-label={`Remove ${b.fileName}`}
                    disabled={busy}
                    onClick={() => onDelete(b)}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function WorkspaceApp({
  initial,
  initialVersion = 0,
  demo,
  email,
}: {
  initial: Workspace;
  initialVersion?: number;
  demo: boolean;
  email?: string;
}) {
  const [snapshot, setSnapshot] = useState(() =>
    demo ? loadLocal(initial, initialVersion) : { workspace: initial, version: initialVersion },
  );
  const ref = useRef(snapshot),
    lock = useRef(false);
  const [view, setView] = useState<View>('dashboard'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('error' in snapshot ? String(snapshot.error) : ''),
    [message, setMessage] = useState(''),
    [batchId, setBatchId] = useState(''),
    [sample, setSample] = useState(false);
  const workspace = snapshot.workspace,
    pending = workspace.batches.filter((b) => b.status === 'review'),
    warningCount = pending.reduce(
      (sum, b) => sum + b.rows.filter((r) => r.warnings.length || r.status === 'blocked').length,
      0,
    );
  async function run(command: Command): Promise<Workspace | null> {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      let next: { workspace: Workspace; version: number };
      if (demo) {
        const currentRaw = localStorage.getItem(STORAGE_KEY);
        if (currentRaw && JSON.parse(currentRaw).version !== ref.current.version) {
          throw new Error('Workspace changed in another tab. Reload before saving.');
        }
        const workspace = executeCommand(ref.current.workspace, command);
        next = { workspace, version: ref.current.version + 1 };
        const raw = JSON.stringify(next);
        if (raw.length > 4000000)
          throw new Error('Demo storage is full. Use an account for larger catalogues.');
        localStorage.setItem(STORAGE_KEY, raw);
      } else {
        const result = await mutateWorkspace(command, ref.current.version);
        if (!result.ok) throw new Error(result.error);
        next = { workspace: result.workspace, version: result.version };
      }
      ref.current = next;
      setSnapshot(next);
      return next.workspace;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function navigate(next: View) {
    setView(next);
    setError('');
    setMessage('');
  }
  function openBatch(id: string) {
    setBatchId(id);
    navigate('review');
  }
  function newUpdate(useSample = false) {
    if (!workspace.suppliers.length) {
      navigate('suppliers');
      setMessage('Add your first supplier before uploading a price list.');
      return;
    }
    setSample(useSample);
    navigate('upload');
  }
  async function loadSample() {
    const result = await run({ type: 'sample.load' });
    if (result)
      setMessage('Sample workspace loaded. Try a supplier update to see the whole workflow.');
  }
  async function signOut() {
    setBusy(true);
    try {
      await browserClient().auth.signOut();
      window.location.assign('/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out');
      setBusy(false);
    }
  }
  const batch = workspace.batches.find((b) => b.id === batchId);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href={demo ? '/demo' : '/app'} className="brand">
          <span className="brand-mark">
            <Layers size={23} />
          </span>
          PricePilot<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
              { id: 'suppliers', label: 'Suppliers', icon: Truck },
              { id: 'catalogue', label: 'Catalogue', icon: Package },
              { id: 'history', label: 'History', icon: History },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'nav-item active' : 'nav-item'}
              aria-current={view === item.id ? 'page' : undefined}
              disabled={busy}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              {item.label}
              {item.id === 'history' && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={22} />
          <strong>You approve. We update.</strong>
          <p>Every price change gets a review before it reaches your catalogue.</p>
        </div>
        <div className="account-box">
          <span className="avatar">{demo ? 'D' : (email?.[0]?.toUpperCase() ?? 'P')}</span>
          <div>
            <strong>{demo ? 'Demo workspace' : 'Your workspace'}</strong>
            <small>{demo ? 'Saved in this browser' : email}</small>
          </div>
          {!demo && (
            <button className="icon-button" aria-label="Sign out" onClick={signOut} disabled={busy}>
              <LogOut size={16} />
            </button>
          )}
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>
              {view === 'dashboard'
                ? 'Overview'
                : view === 'catalogue-import'
                  ? 'Catalogue import'
                  : view === 'upload'
                    ? 'Price update'
                    : view === 'review'
                      ? 'Review'
                      : view[0].toUpperCase() + view.slice(1)}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="connection">
              <span /> {busy ? 'Saving…' : demo ? 'Browser-local demo' : 'Supabase workspace'}
            </span>
            {demo ? (
              <Link className="button secondary small" href="/login">
                Use an account
                <ArrowRight size={14} />
              </Link>
            ) : null}
          </div>
        </header>
        <main id="main-content" className="main-content" aria-busy={busy}>
          {demo && (
            <div className="demo-strip">
              <span>
                <strong>Local demo.</strong> Changes stay in this browser. Account workspaces save
                to Supabase.
              </span>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  if (confirm('Clear local demo data and reload sample products?')) {
                    localStorage.removeItem(STORAGE_KEY);
                    window.location.reload();
                  }
                }}
              >
                <RefreshCw size={13} />
                Reset demo
              </button>
            </div>
          )}
          {error && (
            <div className="notice danger" role="alert">
              {error}{' '}
              <button className="text-button" onClick={() => window.location.reload()}>
                Reload workspace
              </button>
            </div>
          )}
          {message && (
            <div className="notice success" role="status">
              {message}
            </div>
          )}
          {view === 'dashboard' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">A LITTLE LESS MANUAL WORK</span>
                  <h1>Your pricing, under control.</h1>
                  <p>Keep supplier updates moving. Keep your margins in sight.</p>
                </div>
                <button className="button primary" disabled={busy} onClick={() => newUpdate()}>
                  <Plus size={18} />
                  New price update
                </button>
              </div>
              <div className="metrics">
                <article>
                  <div>
                    <span>Catalogue products</span>
                    <Package size={18} />
                  </div>
                  <strong>{workspace.products.length.toLocaleString()}</strong>
                  <small>Prices you can trust</small>
                </article>
                <article>
                  <div>
                    <span>Active suppliers</span>
                    <Truck size={18} />
                  </div>
                  <strong>{workspace.suppliers.length}</strong>
                  <small>Your supply network</small>
                </article>
                <article>
                  <div>
                    <span>Awaiting review</span>
                    <Clock3 size={18} />
                  </div>
                  <strong>{pending.length}</strong>
                  <small>Updates ready for your eyes</small>
                </article>
                <article>
                  <div>
                    <span>Needs attention</span>
                    <ShieldCheck size={18} />
                  </div>
                  <strong>{warningCount}</strong>
                  <small>Warnings and blocked rows</small>
                </article>
              </div>
              <section className="hero-panel">
                <div>
                  <span className="eyebrow">FROM FILE TO FINISHED</span>
                  <h2>
                    A new price list.
                    <br />A clearer next step.
                  </h2>
                  <p>
                    Upload your supplier’s file. We’ll match the products, calculate selling prices,
                    and show you exactly what changed.
                  </p>
                  <div className="button-group">
                    <button className="button primary" disabled={busy} onClick={() => newUpdate()}>
                      <UploadIcon />
                      New price update
                      <ArrowRight size={16} />
                    </button>
                    {workspace.suppliers.some((s) => s.id === 'sample-supplier') ? (
                      <button
                        className="button hero-secondary"
                        disabled={busy}
                        onClick={() => newUpdate(true)}
                      >
                        Try sample update
                      </button>
                    ) : !workspace.suppliers.length ? (
                      <button
                        className="button hero-secondary"
                        disabled={busy}
                        onClick={loadSample}
                      >
                        Load sample workspace
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="hero-visual" aria-hidden="true">
                  <div className="mini-document">
                    <div className="mini-icon">
                      <FileSpreadsheet size={26} />
                    </div>
                    <strong>supplier-prices.csv</strong>
                    <span>SKU · Cost · Description</span>
                    <div className="mini-lines">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                  <div className="mini-approved">
                    <CheckCircle2 size={19} />
                    <div>
                      <strong>Ready for review</strong>
                      <span>Your rules. Your final say.</span>
                    </div>
                  </div>
                </div>
              </section>
              <div className="section-line">
                <div>
                  <h2>Recent updates</h2>
                  <p className="muted">A record of every reviewed price change.</p>
                </div>
                <button className="text-button" onClick={() => navigate('history')}>
                  View history
                  <ArrowRight size={15} />
                </button>
              </div>
              <section className="panel">
                {workspace.batches.length ? (
                  <UpdateTable batches={workspace.batches.slice(0, 5)} onOpen={openBatch} />
                ) : (
                  <Empty
                    title="Your first update starts here"
                    description="Upload a supplier price list to see matched products and price changes."
                  />
                )}
              </section>
              <div className="dashboard-bottom">
                <span>
                  <ShieldCheck size={16} />
                  Invalid rows never change your catalogue.
                </span>
                <label>
                  Workspace currency
                  <select
                    disabled={busy || workspace.products.length > 0 || workspace.batches.length > 0}
                    value={workspace.currency}
                    onChange={(e) =>
                      void run({ type: 'currency.set', currency: e.target.value as 'USD' })
                    }
                  >
                    {['USD', 'EUR', 'GBP', 'PKR', 'CAD', 'AUD'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
          {view === 'suppliers' && (
            <Suppliers workspace={workspace} run={run} busy={busy} error={error} />
          )}{' '}
          {view === 'catalogue' && (
            <Catalogue
              workspace={workspace}
              run={run}
              busy={busy}
              onImport={() => navigate('catalogue-import')}
            />
          )}{' '}
          {view === 'history' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">EVERY CHANGE HAS A RECORD</span>
                  <h1>History</h1>
                  <p>
                    Reopen reviews and download reports. {workspace.batches.length} of 50 saved
                    slots used.
                  </p>
                </div>
                <button className="button primary" disabled={busy} onClick={() => newUpdate()}>
                  <Plus size={17} />
                  New price update
                </button>
              </div>
              <section className="panel">
                {workspace.batches.length ? (
                  <UpdateTable
                    batches={workspace.batches}
                    onOpen={openBatch}
                    busy={busy}
                    onDelete={(batch) => {
                      if (
                        confirm(
                          `Remove ${batch.fileName} and its saved review/report? Download reports first. Catalogue products and prices will stay unchanged.`,
                        )
                      ) {
                        void run({ type: 'batch.delete', batchId: batch.id });
                      }
                    }}
                  />
                ) : (
                  <Empty
                    title="No updates yet"
                    description="Your price updates and reports will appear here."
                  />
                )}
              </section>
            </>
          )}
          {(view === 'upload' || view === 'catalogue-import') && (
            <UploadFlow
              key={`${view}-${sample}`}
              workspace={workspace}
              run={run}
              busy={busy}
              catalogue={view === 'catalogue-import'}
              sample={view === 'upload' && sample}
              onCancel={() => navigate(view === 'catalogue-import' ? 'catalogue' : 'dashboard')}
              onDone={(result) => {
                if (view === 'catalogue-import') {
                  navigate('catalogue');
                  setMessage('Catalogue imported successfully.');
                } else openBatch(result.batches[0].id);
              }}
            />
          )}
          {view === 'review' && batch && (
            <Review
              key={batch.id}
              batch={batch}
              currency={workspace.currency}
              run={run}
              busy={busy}
              onBack={() => navigate('history')}
            />
          )}
          <footer className="app-footer">
            <span>PricePilot</span>
            <span>Clear prices. Confident decisions.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function UploadIcon() {
  return <FileSpreadsheet size={17} />;
}
