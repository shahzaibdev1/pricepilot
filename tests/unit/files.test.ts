import { it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseFile, guessMapping, exportCsv, mappedRows } from '../../src/lib/domain/files';
import type { ReviewRow } from '../../src/lib/domain/types';
const buffer = (s: string) => new TextEncoder().encode(s).buffer;
it('reads quoted CSV, BOM and leading zero SKUs', async () => {
  const file = await parseFile(
    buffer('\uFEFFCode,Description,Price\r\n0012,"A, B",12.50\r\n'),
    'list.csv',
  );
  expect(file.sheets[0].rows).toEqual([{ Code: '0012', Description: 'A, B', Price: '12.50' }]);
});
it('reads semicolon-delimited decimal comma files', async () => {
  const file = await parseFile(buffer('sku;name;cost\nA;Part;12,50'), 'list.csv');
  expect(file.sheets[0].rows[0].cost).toBe('12,50');
});
it('rejects duplicate column headers', async () => {
  await expect(parseFile(buffer('sku,sku,cost\nA,B,12'), 'list.csv')).rejects.toThrow(/header/i);
});
it('rejects malformed CSV rows', async () => {
  await expect(parseFile(buffer('sku,cost\nA,12,extra'), 'list.csv')).rejects.toThrow();
});
it('rejects empty and unsupported files', async () => {
  await expect(parseFile(buffer(''), 'list.csv')).rejects.toThrow();
  await expect(parseFile(buffer('hello'), 'list.pdf')).rejects.toThrow();
});
it('reads XLSX formatted identifiers and sheets without evaluating formulas', async () => {
  const book = new ExcelJS.Workbook();
  const s = book.addWorksheet('Prices');
  s.addRow(['sku', 'name', 'cost']);
  s.addRow(['001', 'Part', 12.5]);
  s.addRow(['002', 'Formula', { formula: '1+1', result: 2 }]);
  const b = await book.xlsx.writeBuffer();
  const file = await parseFile(new Uint8Array(b).buffer, 'list.xlsx');
  expect(file.sheets[0].rows[0]).toEqual({ sku: '001', name: 'Part', cost: '12.5' });
  expect(file.sheets[0].rows[1].cost).toMatch(/^=/);
});
it('guesses supplier column names', () =>
  expect(guessMapping(['Item Code', 'Description', 'Unit Price'])).toEqual({
    sku: 'Item Code',
    name: 'Description',
    cost: 'Unit Price',
  }));
it('allows valid price sheets when another worksheet contains only instructions', async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet('Instructions').addRow(['Please use the Prices tab']);
  const prices = book.addWorksheet('Prices');
  prices.addRow(['sku', 'name', 'cost']);
  prices.addRow(['001', 'Part', 10]);
  const bytes = await book.xlsx.writeBuffer();
  const file = await parseFile(new Uint8Array(bytes).buffer, 'list.xlsx');
  expect(file.sheets.map((sheet) => sheet.name)).toEqual(['Prices']);
  expect(file.warnings?.[0]).toContain('Instructions');
});
it('sends only mapped values instead of expanding unused supplier columns', () => {
  const row = Object.fromEntries(
    Array.from({ length: 100 }, (_, i) => ['Column number ' + i, '12']),
  );
  const rows = Array.from({ length: 5000 }, () => row);
  const mapping = { sku: 'Column number 0', name: 'Column number 1', cost: 'Column number 2' };
  const normalized = mappedRows(rows, mapping);
  expect(Object.keys(normalized[0])).toEqual(Object.values(mapping));
  expect(normalized[0][mapping.cost]).toBe('12');
  expect(Buffer.byteLength(JSON.stringify(normalized))).toBeLessThan(500000);
});
it('rejects expanded mapped data before sending a server action', () => {
  const rows = Array.from({ length: 5000 }, () => ({
    sku: 's'.repeat(500),
    name: 'n'.repeat(500),
    cost: '1'.repeat(500),
  }));
  expect(() => mappedRows(rows, { sku: 'sku', name: 'name', cost: 'cost' })).toThrow(
    /split.*smaller/i,
  );
});
it('exports only approved valid rows and escapes formulas', () => {
  const r: ReviewRow = {
    id: '1',
    sourceRow: 2,
    sourceSku: 'A',
    sku: '=EVIL()',
    name: 'Part, large',
    costCents: 1250,
    sellCents: 1667,
    oldCostCents: null,
    oldSellCents: null,
    productId: null,
    status: 'new',
    issues: [],
    warnings: [],
    approved: true,
  };
  const csv = exportCsv([
    r,
    { ...r, id: '2', sku: 'B', approved: false },
    { ...r, id: '3', status: 'blocked' },
  ]);
  expect(csv).toContain("'=EVIL()");
  expect(csv).toContain('16.67');
  expect(csv).not.toContain('\r\nB,');
  expect(csv.split('\r\n')).toHaveLength(2);
});
