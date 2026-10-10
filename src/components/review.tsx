'use client';
import { useState } from 'react';
import { ArrowLeft, Download, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Batch } from '@/lib/domain/types';
import { formatMoney } from '@/lib/domain/money';
import { exportCsv } from '@/lib/domain/files';
import { Pager, downloadText, dateLabel, type RunCommand } from './shared';
export default function Review({
  batch,
  currency,
  run,
  busy,
  onBack,
}: {
  batch: Batch;
  currency: string;
  run: RunCommand;
  busy: boolean;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(
      batch.rows.filter((r) => r.approved).map((r) => r.id),
    ),
    [filter, setFilter] = useState('all'),
    [page, setPage] = useState(0);
  const applied = batch.status === 'applied';
  const blocked = batch.rows.filter((r) => r.status === 'blocked').length,
    newRows = batch.rows.filter((r) => r.status === 'new').length,
    warnings = batch.rows.filter((r) => r.warnings.length).length;
  const filtered = batch.rows.filter(
    (r) =>
      filter === 'all' ||
      (filter === 'blocked' && r.status === 'blocked') ||
      (filter === 'new' && r.status === 'new') ||
      (filter === 'attention' && r.warnings.length),
  );
  const downloadRows = batch.rows.map((r) => ({
    ...r,
    approved: applied ? r.approved : selected.includes(r.id),
  }));
  async function approveAll() {
    const ids = batch.rows.filter((r) => r.status !== 'blocked').map((r) => r.id);
    const result = await run({ type: 'batch.approve', batchId: batch.id, rowIds: ids });
    if (result) setSelected(ids);
  }
  async function apply() {
    const approved = await run({ type: 'batch.approve', batchId: batch.id, rowIds: selected });
    if (approved) await run({ type: 'batch.apply', batchId: batch.id });
  }
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to history
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{batch.supplierName.toUpperCase()}</span>
          <h1>{applied ? 'Update completed' : 'Review before you update'}</h1>
          <p>
            {batch.fileName} · {dateLabel(batch.createdAt)}
          </p>
        </div>
        <span className={`badge ${applied ? 'good' : 'neutral'}`}>
          {applied ? <CheckCircle2 size={14} /> : null}
          {applied ? 'Applied' : 'Awaiting approval'}
        </span>
      </div>
      {applied && (
        <div className="notice success" role="status">
          <CheckCircle2 size={19} />
          Changes applied. Your catalogue is up to date.
        </div>
      )}
      <div className="review-stats">
        <div>
          <strong>{batch.rows.length}</strong>
          <span>Rows in file</span>
        </div>
        <div>
          <strong>{newRows}</strong>
          <span>New products</span>
        </div>
        <div>
          <strong className="amber-text">{warnings}</strong>
          <span>Price warnings</span>
        </div>
        <div>
          <strong className="red-text">{blocked}</strong>
          <span>Blocked rows</span>
        </div>
      </div>
      {batch.missingSkus.length > 0 && (
        <details className="notice warning">
          <summary>
            {batch.missingSkus.length} existing product
            {batch.missingSkus.length === 1 ? ' is' : 's are'} missing from this file
          </summary>
          <p>These products stay unchanged: {batch.missingSkus.join(', ')}</p>
        </details>
      )}
      <section className="panel">
        <div className="review-toolbar">
          <div className="filter-tabs" role="group" aria-label="Filter review rows">
            {[
              ['all', 'All rows'],
              ['attention', 'Warnings'],
              ['new', 'New products'],
              ['blocked', 'Blocked'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? 'selected' : ''}
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  setPage(0);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {!applied && (
            <button className="button secondary small" disabled={busy} onClick={approveAll}>
              <ShieldCheck size={15} />
              Approve valid rows
            </button>
          )}
        </div>
        <div className="table-scroll">
          <table className="review-table">
            <thead>
              <tr>
                <th scope="col">Approve</th>
                <th scope="col">Product</th>
                <th scope="col">Current cost</th>
                <th scope="col">New cost</th>
                <th scope="col">Selling price</th>
                <th scope="col">Review notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(page * 25, page * 25 + 25).map((r) => (
                <tr key={r.id} className={r.status === 'blocked' ? 'blocked-row' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Approve ${r.sku || 'row ' + r.sourceRow}`}
                      checked={applied ? r.approved : selected.includes(r.id)}
                      disabled={busy || applied || r.status === 'blocked'}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, r.id]
                            : selected.filter((id) => id !== r.id),
                        )
                      }
                    />
                  </td>
                  <td>
                    <strong>{r.name || 'Unnamed product'}</strong>
                    <span className="sku">
                      {r.sku || 'Missing SKU'}
                      {r.sourceSku !== r.sku ? ` · supplier: ${r.sourceSku}` : ''}
                    </span>
                    <span
                      className={`badge ${r.status === 'blocked' ? 'bad' : r.status === 'new' ? 'blue' : 'neutral'}`}
                    >
                      {r.status === 'blocked'
                        ? 'Blocked'
                        : r.status === 'new'
                          ? 'New product'
                          : 'Matched'}
                    </span>
                  </td>
                  <td className="money muted">
                    {r.oldCostCents === null ? '—' : formatMoney(r.oldCostCents, currency)}
                  </td>
                  <td className="money">
                    {r.costCents === null ? 'Invalid' : formatMoney(r.costCents, currency)}
                  </td>
                  <td className="money">
                    <strong>
                      {r.sellCents === null ? '—' : formatMoney(r.sellCents, currency)}
                    </strong>
                    {r.oldSellCents !== null && r.oldSellCents !== r.sellCents && (
                      <span className="old-price">was {formatMoney(r.oldSellCents, currency)}</span>
                    )}
                  </td>
                  <td className="review-notes">
                    {r.issues.map((issue) => (
                      <span className="red-text" key={issue}>
                        {issue}
                      </span>
                    ))}
                    {r.warnings.map((warning) => (
                      <span className="amber-text" key={warning}>
                        <AlertTriangle size={12} />
                        {warning}
                      </span>
                    ))}
                    {!r.issues.length && !r.warnings.length && (
                      <span className="muted">
                        {r.status === 'new' ? 'Approval creates a new product' : 'Ready for review'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="empty compact">No rows in this filter.</div>}
        </div>
        <Pager page={page} total={filtered.length} onChange={setPage} />
      </section>
      <div className="review-footer">
        <div>
          <strong>
            {applied ? batch.rows.filter((r) => r.approved).length : selected.length} rows{' '}
            {applied ? 'applied' : 'selected'}
          </strong>
          <p>Blocked rows are excluded. Approving a new SKU creates a product.</p>
        </div>
        <div className="button-group">
          <button
            className="button secondary"
            onClick={() => downloadText(exportCsv(downloadRows, true), 'price-change-report.csv')}
          >
            <Download size={16} />
            Download change report
          </button>
          {applied ? (
            <button
              className="button primary"
              onClick={() => downloadText(exportCsv(downloadRows), 'product-updates.csv')}
            >
              <Download size={16} />
              Download product CSV
            </button>
          ) : (
            <button className="button primary" disabled={busy || !selected.length} onClick={apply}>
              {busy ? 'Applying…' : 'Apply approved changes'}
            </button>
          )}
        </div>
      </div>
      <p className="field-help">
        Exports use the workspace currency ({currency}) and include only approved valid products.
        Import the downloaded CSV into your store after checking its required column format.
      </p>
    </>
  );
}
