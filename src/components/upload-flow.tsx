'use client';
import { useState } from 'react';
import { UploadCloud, ArrowRight, FileSpreadsheet, Check, ArrowLeft } from 'lucide-react';
import type { Workspace, ParsedFile, Mapping } from '@/lib/domain/types';
import { parseFile, guessMapping, mappedRows } from '@/lib/domain/files';
import { sampleUpdate, sampleCatalogue } from '@/lib/domain/sample';
import { downloadText, type RunCommand } from './shared';
export default function UploadFlow({
  workspace,
  run,
  busy,
  catalogue = false,
  sample = false,
  onDone,
  onCancel,
}: {
  workspace: Workspace;
  run: RunCommand;
  busy: boolean;
  catalogue?: boolean;
  sample?: boolean;
  onDone: (workspace: Workspace) => void;
  onCancel: () => void;
}) {
  const initialSupplier =
    workspace.suppliers.find((s) => s.id === 'sample-supplier') ?? workspace.suppliers[0];
  const sampleSheet: ParsedFile = {
    sheets: [
      {
        name: 'CSV',
        headers: ['Item Code', 'Description', 'Unit Price'],
        rows: [
          { 'Item Code': 'PP-100', Description: 'USB-C hub', 'Unit Price': '22.00' },
          { 'Item Code': 'PP-200', Description: 'Laptop stand', 'Unit Price': '24.00' },
          {
            'Item Code': 'PP-300',
            Description: 'Mechanical keyboard',
            'Unit Price': 'ask supplier',
          },
          { 'Item Code': 'PP-500', Description: 'Cable organizer', 'Unit Price': '3.00' },
        ],
      },
    ],
  };
  const [supplierId, setSupplierId] = useState(initialSupplier?.id ?? ''),
    [file, setFile] = useState<ParsedFile | null>(sample ? sampleSheet : null),
    [fileName, setFileName] = useState(sample ? 'sample-update.csv' : ''),
    [sheetIndex, setSheetIndex] = useState(0),
    [mapping, setMapping] = useState<Mapping>(
      sample
        ? { sku: 'Item Code', name: 'Description', cost: 'Unit Price' }
        : { sku: '', name: '', cost: '' },
    ),
    [sellColumn, setSellColumn] = useState(''),
    [separator, setSeparator] = useState<'.' | ','>('.'),
    [error, setError] = useState(''),
    [parsing, setParsing] = useState(false);
  const sheet = file?.sheets[sheetIndex];
  function chooseMapping(headers: string[], id = supplierId) {
    const saved = workspace.suppliers.find((s) => s.id === id)?.mapping;
    if (
      !catalogue &&
      saved &&
      [saved.sku, saved.cost, ...(saved.name ? [saved.name] : [])].every((h) => headers.includes(h))
    )
      setMapping(saved);
    else setMapping(guessMapping(headers));
    setSellColumn(headers.find((h) => /^(selling_price|sell|retail[ _]price)$/i.test(h)) ?? '');
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    const selected = e.target.files?.[0];
    if (!selected) return;
    setParsing(true);
    try {
      if (selected.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB');
      const parsed = await parseFile(await selected.arrayBuffer(), selected.name);
      setFile(parsed);
      setFileName(selected.name);
      setSheetIndex(0);
      chooseMapping(parsed.sheets[0].headers);
    } catch (e) {
      setFile(null);
      setError(e instanceof Error ? e.message : 'Could not read file');
    } finally {
      setParsing(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sheet) return;
    setError('');
    if (
      catalogue &&
      (!mapping.name ||
        new Set([mapping.sku, mapping.name, mapping.cost, ...(sellColumn ? [sellColumn] : [])])
          .size !==
          3 + (sellColumn ? 1 : 0))
    ) {
      setError('Choose a different column for each catalogue field. A product name is required.');
      return;
    }
    let reviewData: Record<string, string>[] = [];
    if (!catalogue) {
      try {
        reviewData = mappedRows(sheet.rows, mapping);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not prepare product data');
        return;
      }
    }
    const result = await run(
      catalogue
        ? {
            type: 'catalogue.import',
            supplierId,
            separator,
            rows: sheet.rows.map((row) => ({
              sku: row[mapping.sku] ?? '',
              name: row[mapping.name] ?? '',
              cost: row[mapping.cost] ?? '',
              sell: sellColumn ? row[sellColumn] : undefined,
            })),
          }
        : { type: 'batch.create', supplierId, fileName, mapping, separator, rows: reviewData },
    );
    if (result) onDone(result);
  }
  function column(field: keyof Mapping, label: string, optional = false) {
    return (
      <label>
        {label}
        <select
          required={!optional}
          value={mapping[field]}
          onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
        >
          <option value="">{optional ? 'Not included' : 'Choose a column'}</option>
          {sheet?.headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <>
      <button className="back-link" onClick={onCancel}>
        <ArrowLeft size={15} />
        Back to {catalogue ? 'catalogue' : 'overview'}
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {catalogue ? 'BUILD YOUR BASELINE' : 'A CLEAR PATH TO UPDATED PRICES'}
          </span>
          <h1>
            {sheet
              ? 'Match your columns'
              : catalogue
                ? 'Import your catalogue'
                : 'New price update'}
          </h1>
          <p>
            {sheet
              ? 'Tell us where to find your product codes and prices.'
              : catalogue
                ? 'Bring in your current products before reviewing supplier updates.'
                : 'Start with a supplier and their latest price list.'}
          </p>
        </div>
      </div>
      <ol className="stepper">
        <li className={sheet ? 'complete' : 'active'}>
          <span>{sheet ? <Check size={14} /> : 1}</span>Upload file
        </li>
        <li className={sheet ? 'active' : ''}>
          <span>2</span>Match columns
        </li>
        <li>
          <span>3</span>
          {catalogue ? 'Import catalogue' : 'Review changes'}
        </li>
      </ol>
      {error && (
        <div className="notice danger" role="alert">
          {error}
        </div>
      )}
      {file?.warnings?.length ? (
        <div className="notice warning" role="status">
          Skipped workbook sheets: {file.warnings.join(' ')}
        </div>
      ) : null}
      <form onSubmit={submit}>
        <fieldset disabled={busy || parsing}>
          <div className="upload-layout">
            <section className="panel upload-panel">
              <div className="panel-heading">
                <h2>{sheet ? 'Your file is ready' : 'Choose your supplier file'}</h2>
                <span className="badge neutral">CSV / XLSX</span>
              </div>
              <label>
                Supplier
                <select
                  required
                  value={supplierId}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    if (sheet) chooseMapping(sheet.headers, e.target.value);
                  }}
                >
                  <option value="">Choose supplier</option>
                  {workspace.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="dropzone">
                <UploadCloud size={34} />
                <strong>
                  {parsing ? 'Reading your file…' : fileName || 'Upload a price list'}
                </strong>
                <p>CSV or XLSX · up to 5 MB · 5,000 rows</p>
                <label className="file-label">
                  {sheet ? 'Choose another file' : 'Choose file'}
                  <input
                    aria-label="Supplier file"
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={upload}
                  />
                </label>
              </div>
              {sheet && (
                <>
                  <div className="file-summary">
                    <FileSpreadsheet size={20} />
                    <div>
                      <strong>{fileName}</strong>
                      <span>
                        {sheet.rows.length} rows · {sheet.headers.length} columns
                      </span>
                    </div>
                  </div>
                  {file!.sheets.length > 1 && (
                    <label>
                      Workbook sheet
                      <select
                        value={sheetIndex}
                        onChange={(e) => {
                          const index = Number(e.target.value);
                          setSheetIndex(index);
                          chooseMapping(file!.sheets[index].headers);
                        }}
                      >
                        {file!.sheets.map((s, i) => (
                          <option key={s.name} value={i}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  downloadText(
                    catalogue ? sampleCatalogue : sampleUpdate,
                    catalogue ? 'sample-catalogue.csv' : 'sample-update.csv',
                  )
                }
              >
                Download a sample file
              </button>
            </section>
            <section className="panel upload-panel">
              <h2>{sheet ? 'Column mapping' : 'Before you begin'}</h2>
              {sheet ? (
                <>
                  <div className="form-grid">
                    {column('sku', 'SKU column')}
                    {column('cost', 'Cost column')}
                    {column('name', 'Product name column', !catalogue)}
                    {catalogue && (
                      <label>
                        Selling price column
                        <select value={sellColumn} onChange={(e) => setSellColumn(e.target.value)}>
                          <option value="">Calculate with supplier rule</option>
                          {sheet.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Decimal separator
                      <select
                        value={separator}
                        onChange={(e) => setSeparator(e.target.value as '.' | ',')}
                      >
                        <option value=".">Period — 1,234.56</option>
                        <option value=",">Comma — 1.234,56</option>
                      </select>
                    </label>
                  </div>
                  <div className="notice subtle">
                    {catalogue
                      ? 'Existing SKUs for this supplier will be replaced by the values you import. Other products stay in your catalogue.'
                      : 'We’ll remember these columns for your next upload. Unknown SKUs need explicit approval or an alias in supplier settings.'}
                  </div>
                  <button type="submit" className="button primary full">
                    {busy ? 'Saving…' : catalogue ? 'Import catalogue' : 'Review changes'}
                    <ArrowRight size={17} />
                  </button>
                </>
              ) : (
                <div className="guidance">
                  <p>
                    <span>01</span>
                    <strong>Use a unique product code</strong>
                    <small>SKUs connect supplier prices to your catalogue.</small>
                  </p>
                  <p>
                    <span>02</span>
                    <strong>Keep prices in {workspace.currency}</strong>
                    <small>Choose the right decimal separator. No currency conversion.</small>
                  </p>
                  <p>
                    <span>03</span>
                    <strong>Review every change</strong>
                    <small>Invalid prices and duplicates stay blocked.</small>
                  </p>
                </div>
              )}
            </section>
          </div>
          {sheet && (
            <section className="panel preview-panel">
              <div className="panel-heading">
                <h2>File preview</h2>
                <span className="muted">First 5 rows</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {sheet.headers.slice(0, 8).map((h) => (
                        <th key={h} scope="col">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        {sheet.headers.slice(0, 8).map((h) => (
                          <td key={h}>{r[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </fieldset>
      </form>
    </>
  );
}
