import { it, expect } from 'vitest';
import { executeCommand } from '../../src/lib/domain/commands';
import { emptyWorkspace, type Supplier } from '../../src/lib/domain/types';
const supplier: Supplier = {
  id: 's',
  name: 'Acme',
  currency: 'USD',
  rule: { mode: 'margin', percent: 25, warningPercent: 20 },
  aliases: {},
};
const ws = () => ({ ...emptyWorkspace(), suppliers: [supplier] });
it('saves a supplier and rejects duplicate names', () => {
  const data = executeCommand(emptyWorkspace(), { type: 'supplier.save', supplier });
  expect(data.suppliers[0].name).toBe('Acme');
  expect(() =>
    executeCommand(data, {
      type: 'supplier.save',
      supplier: { ...supplier, id: 'other', name: ' ACME ' },
    }),
  ).toThrow(/exists/i);
});
it('validates pricing and alias targets before saving', () => {
  expect(() =>
    executeCommand(ws(), {
      type: 'supplier.save',
      supplier: { ...supplier, rule: { ...supplier.rule, percent: 100 } },
    }),
  ).toThrow();
  expect(() =>
    executeCommand(ws(), {
      type: 'supplier.save',
      supplier: { ...supplier, aliases: { Vendor: 'MISSING' } },
    }),
  ).toThrow(/alias/i);
});
it('imports a catalogue atomically with preserved SKUs', () => {
  const result = executeCommand(ws(), {
    type: 'catalogue.import',
    supplierId: 's',
    rows: [{ sku: '001', name: 'Part', cost: '12', sell: '20' }],
    separator: '.',
  });
  expect(result.products[0].sku).toBe('001');
  expect(result.products[0].sellCents).toBe(2000);
  expect(result.catalogVersion).toBe(1);
});
it('rejects duplicate or invalid catalogue rows without mutation', () => {
  const data = ws();
  expect(() =>
    executeCommand(data, {
      type: 'catalogue.import',
      supplierId: 's',
      rows: [
        { sku: 'A', name: 'X', cost: '10' },
        { sku: 'a', name: 'X', cost: '11' },
      ],
      separator: '.',
    }),
  ).toThrow(/duplicate/i);
  expect(data.products).toEqual([]);
});
it('refuses to switch currency once products exist', () => {
  const data = executeCommand(ws(), {
    type: 'catalogue.import',
    supplierId: 's',
    rows: [{ sku: 'A', name: 'X', cost: '10' }],
    separator: '.',
  });
  expect(() => executeCommand(data, { type: 'currency.set', currency: 'EUR' })).toThrow(
    /currency/i,
  );
});
it('creates a review then applies only explicitly approved valid rows', () => {
  let data = ws();
  data = executeCommand(data, {
    type: 'batch.create',
    supplierId: 's',
    fileName: 'prices.csv',
    mapping: { sku: 'SKU', name: 'Name', cost: 'Cost' },
    separator: '.',
    rows: [
      { SKU: 'A', Name: 'Widget', Cost: '10' },
      { SKU: 'B', Name: 'Bad', Cost: 'oops' },
    ],
  });
  const batch = data.batches[0];
  expect(() =>
    executeCommand(data, { type: 'batch.approve', batchId: batch.id, rowIds: [batch.rows[1].id] }),
  ).toThrow(/blocked/i);
  data = executeCommand(data, {
    type: 'batch.approve',
    batchId: batch.id,
    rowIds: [batch.rows[0].id],
  });
  data = executeCommand(data, { type: 'batch.apply', batchId: batch.id });
  expect(data.products.map((p) => p.sku)).toEqual(['A']);
});
it('rejects unknown commands and excessively long inputs', () => {
  expect(() => executeCommand(ws(), { type: 'all.delete' })).toThrow();
  expect(() =>
    executeCommand(ws(), {
      type: 'supplier.save',
      supplier: { ...supplier, name: 'X'.repeat(500) },
    }),
  ).toThrow();
});
