import { it, expect } from 'vitest';
import { reviewRows, applyBatch, createBatch } from '../../src/lib/domain/review';
import { emptyWorkspace, type Supplier, type Product } from '../../src/lib/domain/types';
const supplier: Supplier = {
  id: 's',
  name: 'Acme',
  currency: 'USD',
  rule: { mode: 'margin', percent: 25, warningPercent: 20 },
  aliases: { 'vendor-1': 'A' },
};
const product: Product = {
  id: 'p',
  sku: 'A',
  name: 'Widget',
  costCents: 1000,
  sellCents: 1500,
  supplierId: 's',
};
const mapping = { sku: 'sku', name: 'name', cost: 'cost' };
const run = (rows: Record<string, string>[]) => reviewRows(rows, mapping, supplier, [product], '.');
it('matches normalized SKUs and flags large price increases', () => {
  const r = run([{ sku: ' a ', name: 'Widget', cost: '15' }])[0];
  expect(r.status).toBe('matched');
  expect(r.productId).toBe('p');
  expect(r.sellCents).toBe(2000);
  expect(r.warnings.join(' ')).toMatch(/increase/i);
  expect(r.approved).toBe(false);
});
it('uses supplier-specific aliases', () =>
  expect(run([{ sku: 'VENDOR-1', name: 'Widget', cost: '11' }])[0].productId).toBe('p'));
it('marks unknown SKUs as new, never auto-approves', () => {
  const r = run([{ sku: 'NEW', name: 'New product', cost: '10' }])[0];
  expect(r.status).toBe('new');
  expect(r.approved).toBe(false);
});
it('blocks all duplicates including alias collisions', () => {
  expect(
    run([
      { sku: 'A', name: 'Widget', cost: '10' },
      { sku: 'vendor-1', name: 'Widget', cost: '12' },
    ]).map((r) => r.status),
  ).toEqual(['blocked', 'blocked']);
});
it('blocks missing SKUs, missing names for new items and invalid costs', () => {
  expect(
    run([
      { sku: '', name: 'Bad', cost: '1' },
      { sku: 'B', name: '', cost: '2' },
      { sku: 'C', name: 'C', cost: 'oops' },
    ]).map((r) => r.status),
  ).toEqual(['blocked', 'blocked', 'blocked']);
});
it('does not match another supplier product', () =>
  expect(
    reviewRows(
      [{ sku: 'A', name: 'X', cost: '12' }],
      mapping,
      supplier,
      [{ ...product, supplierId: 'other' }],
      '.',
    )[0].status,
  ).toBe('blocked'));
it('rejects missing mapped columns', () => expect(() => run([{ wrong: 'A' }])).toThrow(/column/i));
it('applies reviewed rows atomically and idempotently', () => {
  const ws = { ...emptyWorkspace(), suppliers: [supplier], products: [product] };
  const rows = run([
    { sku: 'A', name: 'Widget', cost: '12' },
    { sku: 'B', name: 'Second', cost: '5' },
  ]).map((r) => ({ ...r, approved: true }));
  const batch = createBatch(ws, supplier, 'list.csv', rows);
  ws.batches = [batch];
  const result = applyBatch(ws, batch.id);
  expect(result.products).toHaveLength(2);
  expect(result.products[0].costCents).toBe(1200);
  expect(result.products[0].sellCents).toBe(1600);
  expect(result.batches[0].status).toBe('applied');
  expect(applyBatch(result, batch.id)).toEqual(result);
  expect(ws.products[0].costCents).toBe(1000);
});
it('rejects stale catalogue and no approvals', () => {
  const ws = { ...emptyWorkspace(), suppliers: [supplier], products: [product] };
  const batch = createBatch(ws, supplier, 'list.csv', run([{ sku: 'A', name: 'X', cost: '12' }]));
  ws.batches = [batch];
  expect(() => applyBatch(ws, batch.id)).toThrow(/approve/i);
  expect(() => applyBatch({ ...ws, catalogVersion: 1 }, batch.id)).toThrow(/changed|stale/i);
});
it('reports missing supplier SKUs without deleting them', () => {
  const ws = { ...emptyWorkspace(), products: [product] };
  const b = createBatch(ws, supplier, 'list.csv', run([{ sku: 'B', name: 'New', cost: '1' }]));
  expect(b.missingSkus).toEqual(['A']);
});
