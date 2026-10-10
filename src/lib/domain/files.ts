import type { ParsedFile, Mapping, ReviewRow } from './types';
import Papa from 'papaparse';
const MAX_ROWS = 5000;
function makeSheet(name: string, table: string[][]) {
  const nonempty = table.filter((row) => row.some((value) => value.trim() !== ''));
  const headers = nonempty.shift()?.map((h) => h.trim()) ?? [];
  if (
    !headers.length ||
    headers.some((h) => !h) ||
    new Set(headers.map((h) => h.toLowerCase())).size !== headers.length
  )
    throw new Error('Column headers must be present and unique');
  if (!nonempty.length) throw new Error('The file contains no product rows');
  if (nonempty.length > MAX_ROWS) throw new Error('Upload at most 5,000 rows at a time');
  if (headers.length > 100) throw new Error('Upload at most 100 columns');
  if (nonempty.some((r) => r.length > headers.length))
    throw new Error('A row has more values than column headers');
  return {
    name,
    headers,
    rows: nonempty.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))),
  };
}
export async function parseFile(bytes: ArrayBuffer, name: string): Promise<ParsedFile> {
  if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024)
    throw new Error('Choose a non-empty file smaller than 5 MB');
  if (name.toLowerCase().endsWith('.csv')) {
    const parsed = Papa.parse<string[]>(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''),
      { skipEmptyLines: 'greedy' },
    );
    if (parsed.errors.length) throw new Error('Could not read CSV: ' + parsed.errors[0].message);
    return { sheets: [makeSheet('CSV', parsed.data)] };
  }
  if (!name.toLowerCase().endsWith('.xlsx')) throw new Error('Please upload a CSV or XLSX file');
  try {
    const { default: ExcelJS } = await import('exceljs');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes);
    const sheets: ParsedFile['sheets'] = [];
    for (const sheet of book.worksheets) {
      if (sheet.state !== 'visible' || sheet.actualRowCount === 0) continue;
      if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > 100)
        throw new Error('Workbook exceeds 5,000 rows or 100 columns per sheet');
      const table: string[][] = [];
      sheet.eachRow((row) => {
        const values: string[] = [];
        for (let i = 1; i <= sheet.columnCount; i++) {
          const cell = row.getCell(i);
          const v = cell.value;
          let text = cell.text;
          if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v))
            text = '=' + ('formula' in v ? v.formula : 'FORMULA');
          else if (typeof v === 'number' && /^0+$/.test(cell.numFmt))
            text = String(v).padStart(cell.numFmt.length, '0');
          values.push(text);
        }
        table.push(values);
      });
      sheets.push(makeSheet(sheet.name, table));
    }
    if (!sheets.length) throw new Error('Workbook contains no visible product sheets');
    return { sheets };
  } catch (error) {
    throw new Error(
      error instanceof Error ? 'Could not read XLSX: ' + error.message : 'Could not read XLSX',
      { cause: error },
    );
  }
}
export function guessMapping(headers: string[]): Mapping {
  const find = (pattern: RegExp) => headers.find((h) => pattern.test(h.trim())) ?? '';
  return {
    sku: find(/^(sku|item[ _-]?(code|number)|product[ _-]?code|code|part[ _-]?(no|number))$/i),
    name: find(/^(name|description|product[ _-]?name|item[ _-]?name)$/i),
    cost: find(/^(cost|price|unit[ _-]?(cost|price)|wholesale[ _-]?price)$/i),
  };
}
export function exportCsv(rows: ReviewRow[], report = false): string {
  const selected = report
    ? rows
    : rows.filter(
        (r) => r.approved && r.status !== 'blocked' && r.costCents !== null && r.sellCents !== null,
      );
  const records = selected.map((r) =>
    report
      ? {
          source_row: r.sourceRow,
          supplier_sku: r.sourceSku,
          sku: r.sku,
          name: r.name,
          old_cost: r.oldCostCents === null ? '' : (r.oldCostCents / 100).toFixed(2),
          new_cost: r.costCents === null ? '' : (r.costCents / 100).toFixed(2),
          selling_price: r.sellCents === null ? '' : (r.sellCents / 100).toFixed(2),
          status: r.status,
          approved: r.approved ? 'yes' : 'no',
          issues: r.issues.join('; '),
          warnings: r.warnings.join('; '),
        }
      : {
          sku: r.sku,
          name: r.name,
          cost: (r.costCents! / 100).toFixed(2),
          selling_price: (r.sellCents! / 100).toFixed(2),
        },
  );
  return Papa.unparse(records, {
    escapeFormulae: true,
    columns: report
      ? [
          'source_row',
          'supplier_sku',
          'sku',
          'name',
          'old_cost',
          'new_cost',
          'selling_price',
          'status',
          'approved',
          'issues',
          'warnings',
        ]
      : ['sku', 'name', 'cost', 'selling_price'],
  });
}
