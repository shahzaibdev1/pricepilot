'use client';
import { useState } from 'react';
import { Search, Upload, Download, Trash2 } from 'lucide-react';
import type { Workspace, ReviewRow } from '@/lib/domain/types';
import { formatMoney } from '@/lib/domain/money';
import { exportCsv } from '@/lib/domain/files';
import { Pager, Empty, downloadText, type RunCommand } from './shared';
export default function Catalogue({
  workspace,
  run,
  busy,
  onImport,
}: {
  workspace: Workspace;
  run: RunCommand;
  busy: boolean;
  onImport: () => void;
}) {
  const [query, setQuery] = useState(''),
    [supplier, setSupplier] = useState(''),
    [page, setPage] = useState(0);
  const products = workspace.products.filter(
    (p) =>
      (!supplier || p.supplierId === supplier) &&
      (!query || `${p.sku} ${p.name}`.toLowerCase().includes(query.toLowerCase())),
  );
  function download() {
    const rows: ReviewRow[] = products.map((p) => ({
      id: p.id,
      sourceRow: 2,
      sourceSku: p.sku,
      sku: p.sku,
      name: p.name,
      costCents: p.costCents,
      sellCents: p.sellCents,
      oldCostCents: null,
      oldSellCents: null,
      productId: p.id,
      status: 'matched',
      issues: [],
      warnings: [],
      approved: true,
    }));
    downloadText(exportCsv(rows), 'catalogue.csv');
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A RELIABLE BASELINE</span>
          <h1>Catalogue</h1>
          <p>Your products and their latest approved prices.</p>
        </div>
        <div className="button-group">
          <button className="button secondary" disabled={!products.length} onClick={download}>
            <Download size={16} />
            Export CSV
          </button>
          <button
            className="button primary"
            disabled={busy || !workspace.suppliers.length}
            onClick={onImport}
          >
            <Upload size={16} />
            Import catalogue
          </button>
        </div>
      </div>
      <section className="panel">
        <div className="catalogue-toolbar">
          <label className="search-field">
            <Search size={17} />
            <span className="sr-only">Search products</span>
            <input
              placeholder="Search by product name or SKU"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Filter by supplier</span>
            <select
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All suppliers</option>
              {workspace.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {products.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Supplier</th>
                    <th scope="col">Cost</th>
                    <th scope="col">Selling price</th>
                    <th scope="col">Gross margin</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(page * 25, page * 25 + 25).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <span className="sku">{p.sku}</span>
                      </td>
                      <td>
                        {workspace.suppliers.find((s) => s.id === p.supplierId)?.name ?? 'Unknown'}
                      </td>
                      <td className="money">{formatMoney(p.costCents, workspace.currency)}</td>
                      <td className="money">
                        <strong>{formatMoney(p.sellCents, workspace.currency)}</strong>
                      </td>
                      <td>
                        <span className={`badge ${p.sellCents <= p.costCents ? 'bad' : 'good'}`}>
                          {(((p.sellCents - p.costCents) / p.sellCents) * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${p.sku}`}
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                `Delete ${p.name} (${p.sku}) from the catalogue? Pending reviews will need to be recreated.`,
                              )
                            )
                              void run({ type: 'product.delete', productId: p.id });
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={products.length} onChange={setPage} />
          </>
        ) : (
          <Empty
            title={
              workspace.products.length ? 'No matching products' : 'Your catalogue starts here'
            }
            description={
              workspace.products.length
                ? 'Try another search or supplier.'
                : 'Add a supplier, then import your current product file.'
            }
          />
        )}
      </section>
    </>
  );
}
