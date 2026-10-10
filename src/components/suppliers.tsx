'use client';
import { useState } from 'react';
import { Plus, Truck, Pencil, Trash2 } from 'lucide-react';
import type { Supplier, Workspace } from '@/lib/domain/types';
import { Modal, Empty, type RunCommand } from './shared';
function SupplierEditor({
  supplier,
  workspace,
  run,
  busy,
  saveError,
  onClose,
}: {
  supplier: Supplier;
  workspace: Workspace;
  run: RunCommand;
  busy: boolean;
  saveError: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(supplier.name),
    [mode, setMode] = useState(supplier.rule.mode),
    [percent, setPercent] = useState(String(supplier.rule.percent)),
    [warning, setWarning] = useState(String(supplier.rule.warningPercent));
  const [aliases, setAliases] = useState(
      Object.entries(supplier.aliases).map(([source, target]) => ({ source, target })),
    ),
    [error, setError] = useState('');
  const products = workspace.products.filter((p) => p.supplierId === supplier.id);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const cleaned = aliases.filter((a) => a.source.trim() || a.target);
    if (
      cleaned.some((a) => !a.source.trim() || !a.target) ||
      new Set(cleaned.map((a) => a.source.trim().toUpperCase())).size !== cleaned.length
    ) {
      setError('Each alias needs a unique supplier SKU and a catalogue product.');
      return;
    }
    const result = await run({
      type: 'supplier.save',
      supplier: {
        ...supplier,
        name,
        rule: { mode, percent: Number(percent), warningPercent: Number(warning) },
        aliases: Object.fromEntries(cleaned.map((a) => [a.source, a.target])),
      },
    });
    if (result) onClose();
  }
  return (
    <Modal title={supplier.name ? 'Supplier settings' : 'Add supplier'} onClose={onClose}>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Supplier name
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Northstar Supply"
            />
          </label>
          <div className="form-grid">
            <label>
              Pricing method
              <select value={mode} onChange={(e) => setMode(e.target.value as 'markup' | 'margin')}>
                <option value="margin">Target gross margin</option>
                <option value="markup">Markup on cost</option>
              </select>
            </label>
            <label>
              Pricing percentage
              <div className="input-suffix">
                <input
                  type="number"
                  required
                  min={0}
                  max={mode === 'margin' ? 99.99 : 1000}
                  step="0.01"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                />
                <span>%</span>
              </div>
            </label>
          </div>
          <p className="field-help">
            {mode === 'margin'
              ? '35% margin means profit is 35% of the selling price.'
              : '35% markup adds 35% to your cost.'}{' '}
            Prices round up to the nearest cent.
          </p>
          <label>
            Flag cost increases above
            <div className="input-suffix">
              <input
                type="number"
                min={0}
                max={1000}
                step="0.1"
                required
                value={warning}
                onChange={(e) => setWarning(e.target.value)}
              />
              <span>%</span>
            </div>
          </label>
          <div className="section-line">
            <h3>Supplier SKU aliases</h3>
            <button
              type="button"
              className="text-button"
              disabled={!products.length}
              onClick={() => setAliases([...aliases, { source: '', target: '' }])}
            >
              <Plus size={14} />
              Add alias
            </button>
          </div>
          <p className="field-help">
            Map a supplier’s code to your existing SKU. Exact matches only. Import catalogue
            products first.
          </p>
          {aliases.map((alias, i) => (
            <div className="alias-row" key={i}>
              <label className="sr-only" htmlFor={`alias-${i}`}>
                Supplier SKU {i + 1}
              </label>
              <input
                id={`alias-${i}`}
                placeholder="Supplier SKU"
                value={alias.source}
                onChange={(e) =>
                  setAliases(
                    aliases.map((a, n) => (n === i ? { ...a, source: e.target.value } : a)),
                  )
                }
              />
              <label className="sr-only" htmlFor={`target-${i}`}>
                Catalogue SKU {i + 1}
              </label>
              <select
                id={`target-${i}`}
                value={alias.target}
                onChange={(e) =>
                  setAliases(
                    aliases.map((a, n) => (n === i ? { ...a, target: e.target.value } : a)),
                  )
                }
              >
                <option value="">Choose product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.sku} · {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove alias ${i + 1}`}
                onClick={() => setAliases(aliases.filter((_, n) => n !== i))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {(error || saveError) && (
            <p role="alert" className="notice danger">
              {error || saveError}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary">
              {busy ? 'Saving…' : 'Save supplier'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
export default function Suppliers({
  workspace,
  run,
  busy,
  error = '',
}: {
  workspace: Workspace;
  run: RunCommand;
  busy: boolean;
  error?: string;
}) {
  const [editing, setEditing] = useState<Supplier | null>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SUPPLY NETWORK</span>
          <h1>Suppliers</h1>
          <p>One set of pricing rules for every supplier.</p>
        </div>
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              name: '',
              currency: workspace.currency,
              rule: { mode: 'margin', percent: 35, warningPercent: 20 },
              aliases: {},
            })
          }
        >
          <Plus size={17} />
          Add supplier
        </button>
      </div>
      {workspace.suppliers.length ? (
        <div className="supplier-grid">
          {workspace.suppliers.map((s) => (
            <article className="supplier-card" key={s.id}>
              <div className="supplier-top">
                <span className="supplier-icon">
                  <Truck size={21} />
                </span>
                <span className="badge neutral">{s.currency}</span>
              </div>
              <h2>{s.name}</h2>
              <p>
                {workspace.products.filter((p) => p.supplierId === s.id).length} catalogue products
              </p>
              <div className="supplier-rule">
                <strong>{s.rule.percent}%</strong>
                <span>{s.rule.mode === 'margin' ? 'target gross margin' : 'markup on cost'}</span>
              </div>
              <div className="supplier-meta">
                <span>Increase warning</span>
                <strong>Above {s.rule.warningPercent}%</strong>
              </div>
              <div className="supplier-meta">
                <span>SKU aliases</span>
                <strong>{Object.keys(s.aliases).length}</strong>
              </div>
              <button
                className="button secondary full"
                onClick={() => setEditing(s)}
                disabled={busy}
              >
                <Pencil size={15} />
                Manage supplier
              </button>
              {!workspace.products.some((p) => p.supplierId === s.id) &&
                !workspace.batches.some((b) => b.supplierId === s.id) && (
                  <button
                    className="text-button delete-link"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Delete ${s.name}?`))
                        void run({ type: 'supplier.delete', supplierId: s.id });
                    }}
                  >
                    Delete unused supplier
                  </button>
                )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Start with a supplier"
          description="Add a supplier and choose how you calculate your selling prices."
        />
      )}
      {editing && (
        <SupplierEditor
          key={editing.id}
          supplier={editing}
          workspace={workspace}
          run={run}
          busy={busy}
          saveError={error}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
