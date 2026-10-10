import type { Workspace } from './types';
import { commandSchema, workspaceSchema } from './schema';
import { normalizeSku, reviewRows, createBatch, applyBatch } from './review';
import { parseMoney, sellingPrice } from './money';
import { sampleWorkspace } from './sample';
export function executeCommand(workspace: Workspace, input: unknown): Workspace {
  const command = commandSchema.parse(input);
  const next = structuredClone(workspace);
  if (command.type === 'sample.load') {
    if (next.products.length || next.suppliers.length || next.batches.length)
      throw new Error('Sample data can only be loaded into an empty workspace');
    return sampleWorkspace();
  }
  if (command.type === 'currency.set') {
    if (next.products.length || next.batches.length)
      throw new Error('Currency cannot change after products or updates exist');
    next.currency = command.currency;
    next.suppliers.forEach((s) => (s.currency = command.currency));
    return next;
  }
  if (command.type === 'supplier.save') {
    const supplier = command.supplier;
    if (supplier.currency !== next.currency)
      throw new Error('Supplier currency must match the workspace currency');
    if (
      next.suppliers.some(
        (s) => s.id !== supplier.id && s.name.toLowerCase() === supplier.name.toLowerCase(),
      )
    )
      throw new Error('A supplier with that name already exists');
    const aliases: Record<string, string> = {};
    for (const [source, target] of Object.entries(supplier.aliases)) {
      const product = next.products.find(
        (p) => p.supplierId === supplier.id && normalizeSku(p.sku) === normalizeSku(target),
      );
      if (!product) throw new Error('Alias must point to an existing product for this supplier');
      const key = normalizeSku(source);
      if (!key || Object.hasOwn(aliases, key)) throw new Error('Duplicate or empty supplier alias');
      aliases[key] = product.sku;
    }
    const i = next.suppliers.findIndex((s) => s.id === supplier.id);
    if (i >= 0) {
      next.suppliers[i] = { ...supplier, aliases };
      next.catalogVersion++;
    } else next.suppliers.push({ ...supplier, aliases });
  } else if (command.type === 'supplier.delete') {
    if (
      next.products.some((p) => p.supplierId === command.supplierId) ||
      next.batches.some((b) => b.supplierId === command.supplierId)
    )
      throw new Error('A supplier with products or history cannot be deleted');
    next.suppliers = next.suppliers.filter((s) => s.id !== command.supplierId);
  } else if (command.type === 'product.delete') {
    if (!next.products.some((p) => p.id === command.productId))
      throw new Error('Product not found');
    next.products = next.products.filter((p) => p.id !== command.productId);
    next.catalogVersion++;
  } else if (command.type === 'catalogue.import') {
    const supplier = next.suppliers.find((s) => s.id === command.supplierId);
    if (!supplier) throw new Error('Supplier not found');
    const seen = new Set<string>();
    for (const record of command.rows) {
      const sku = record.sku.trim(),
        name = record.name.trim();
      if (!sku || !name) throw new Error('Every catalogue row needs a SKU and name');
      const key = normalizeSku(sku);
      if (seen.has(key)) throw new Error('Duplicate SKU in catalogue file: ' + sku);
      seen.add(key);
      const previous = next.products.find((p) => normalizeSku(p.sku) === key);
      if (previous && previous.supplierId !== supplier.id)
        throw new Error('SKU belongs to another supplier: ' + sku);
      const costCents = parseMoney(record.cost, command.separator),
        sellCents = record.sell?.trim()
          ? parseMoney(record.sell, command.separator)
          : sellingPrice(costCents, supplier.rule);
      const product = {
        id: previous?.id ?? crypto.randomUUID(),
        sku,
        name,
        costCents,
        sellCents,
        supplierId: supplier.id,
      };
      const index = next.products.findIndex((p) => p.id === product.id);
      if (index >= 0) next.products[index] = product;
      else next.products.push(product);
    }
    next.catalogVersion++;
  } else if (command.type === 'batch.create') {
    const supplier = next.suppliers.find((s) => s.id === command.supplierId);
    if (!supplier) throw new Error('Supplier not found');
    if (next.batches.length >= 50)
      throw new Error(
        'Your 50 saved update slots are full. Export reports and remove old updates in History to make room.',
      );
    const rows = reviewRows(
      command.rows,
      command.mapping,
      supplier,
      next.products,
      command.separator,
    );
    supplier.mapping = command.mapping;
    next.batches.unshift(createBatch(next, supplier, command.fileName, rows));
  } else if (command.type === 'batch.approve') {
    const batch = next.batches.find((b) => b.id === command.batchId);
    if (!batch) throw new Error('Update not found');
    if (batch.status === 'applied') throw new Error('An applied update cannot be changed');
    const selected = new Set(command.rowIds);
    if (
      command.rowIds.length !== selected.size ||
      command.rowIds.some((id) => !batch.rows.some((r) => r.id === id))
    )
      throw new Error('Approval contains invalid row IDs');
    if (batch.rows.some((r) => selected.has(r.id) && r.status === 'blocked'))
      throw new Error('Blocked rows cannot be approved');
    batch.rows.forEach((r) => (r.approved = selected.has(r.id)));
  } else if (command.type === 'batch.delete') {
    if (!next.batches.some((b) => b.id === command.batchId)) throw new Error('Update not found');
    next.batches = next.batches.filter((b) => b.id !== command.batchId);
  } else if (command.type === 'batch.apply') return applyBatch(next, command.batchId);
  return workspaceSchema.parse(next);
}
