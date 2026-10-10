import type { Supplier, Product, Mapping, Batch, Workspace, ReviewRow } from './types';
import { parseMoney, sellingPrice } from './money';
export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}
export function reviewRows(
  rows: Record<string, string>[],
  mapping: Mapping,
  supplier: Supplier,
  products: Product[],
  separator: '.' | ',',
): ReviewRow[] {
  if (!rows.length || rows.length > 5000)
    throw new Error('Choose between 1 and 5,000 product rows');
  if (
    !mapping.sku ||
    !mapping.cost ||
    mapping.sku === mapping.cost ||
    (mapping.name && (mapping.name === mapping.sku || mapping.name === mapping.cost))
  )
    throw new Error('Choose a different column for each field');
  for (const key of [mapping.sku, mapping.cost, ...(mapping.name ? [mapping.name] : [])])
    if (!Object.hasOwn(rows[0], key)) throw new Error('A mapped column is missing: ' + key);
  const aliases = Object.fromEntries(
    Object.entries(supplier.aliases).map(([k, v]) => [normalizeSku(k), v]),
  );
  const result: ReviewRow[] = rows.map((record, index) => {
    const sourceSku = (record[mapping.sku] ?? '').trim();
    const sku = aliases[normalizeSku(sourceSku)] ?? sourceSku;
    const product = products.find((p) => normalizeSku(p.sku) === normalizeSku(sku));
    const issues: string[] = [];
    const warnings: string[] = [];
    let costCents: number | null = null;
    let sellCents: number | null = null;
    const name = product?.name || (record[mapping.name] ?? '').trim();
    if (!sku) issues.push('SKU is missing');
    if (sku.length > 120 || name.length > 300) issues.push('SKU or product name is too long');
    if (!name) issues.push('New products need a name');
    if (product && product.supplierId !== supplier.id)
      issues.push('SKU belongs to another supplier');
    try {
      costCents = parseMoney(record[mapping.cost] ?? '', separator);
      sellCents = sellingPrice(costCents, supplier.rule);
    } catch (e) {
      issues.push(e instanceof Error ? e.message : 'Invalid price');
    }
    if (product && costCents !== null) {
      const increase = ((costCents - product.costCents) / product.costCents) * 100;
      if (increase > supplier.rule.warningPercent)
        warnings.push(
          `Cost increase of ${increase.toFixed(1)}% exceeds ${supplier.rule.warningPercent}%`,
        );
      const margin = ((product.sellCents - costCents) / product.sellCents) * 100;
      if (margin < 0) warnings.push('Current selling price is below the new cost');
      else if (supplier.rule.mode === 'margin' && margin < supplier.rule.percent)
        warnings.push('Current selling price falls below your target margin');
    }
    return {
      id: crypto.randomUUID(),
      sourceRow: index + 2,
      sourceSku,
      sku: product?.sku ?? sku,
      name,
      costCents,
      sellCents,
      oldCostCents: product?.costCents ?? null,
      oldSellCents: product?.sellCents ?? null,
      productId: product?.id ?? null,
      status: issues.length ? 'blocked' : product ? 'matched' : 'new',
      issues,
      warnings,
      approved: false,
    };
  });
  const counts = new Map<string, number>();
  result.forEach((r) =>
    counts.set(normalizeSku(r.sku), (counts.get(normalizeSku(r.sku)) ?? 0) + 1),
  );
  for (const row of result)
    if (row.sku && (counts.get(normalizeSku(row.sku)) ?? 0) > 1) {
      row.issues.push('Duplicate SKU or alias in this file');
      row.status = 'blocked';
    }
  return result;
}
export function applyBatch(workspace: Workspace, batchId: string): Workspace {
  const original = workspace.batches.find((b) => b.id === batchId);
  if (!original) throw new Error('Update not found');
  if (original.status === 'applied') return workspace;
  if (original.baseCatalogVersion !== workspace.catalogVersion)
    throw new Error(
      'Your catalogue changed since this review. Upload the file again to review current prices.',
    );
  const approved = original.rows.filter((r) => r.approved);
  if (!approved.length) throw new Error('Approve at least one valid row before applying');
  if (
    approved.some(
      (r) =>
        r.status === 'blocked' || r.costCents === null || r.sellCents === null || r.issues.length,
    )
  )
    throw new Error('Blocked rows cannot be applied');
  const next = structuredClone(workspace);
  for (const row of approved) {
    const index = next.products.findIndex((p) => p.id === row.productId);
    const product = {
      id: row.productId ?? crypto.randomUUID(),
      sku: row.sku,
      name: row.name,
      costCents: row.costCents!,
      sellCents: row.sellCents!,
      supplierId: original.supplierId,
    };
    if (index >= 0) next.products[index] = product;
    else next.products.push(product);
  }
  if (next.products.length > 5000) throw new Error('Catalogue limit is 5,000 products');
  const keys = next.products.map((p) => normalizeSku(p.sku));
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate catalogue SKU');
  next.catalogVersion++;
  const batch = next.batches.find((b) => b.id === batchId)!;
  batch.status = 'applied';
  batch.appliedAt = new Date().toISOString();
  return next;
}
export function createBatch(
  workspace: Workspace,
  supplier: Supplier,
  fileName: string,
  rows: ReviewRow[],
): Batch {
  const seen = new Set(rows.map((r) => normalizeSku(r.sku)));
  return {
    id: crypto.randomUUID(),
    supplierId: supplier.id,
    supplierName: supplier.name,
    fileName,
    createdAt: new Date().toISOString(),
    status: 'review',
    baseCatalogVersion: workspace.catalogVersion,
    rows,
    missingSkus: workspace.products
      .filter((p) => p.supplierId === supplier.id && !seen.has(normalizeSku(p.sku)))
      .map((p) => p.sku),
  };
}
