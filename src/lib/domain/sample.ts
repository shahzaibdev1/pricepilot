import type { Workspace } from './types';
export const sampleUpdate =
  'Item Code,Description,Unit Price\nPP-100,USB-C hub,22.00\nPP-200,Laptop stand,24.00\nPP-300,Mechanical keyboard,ask supplier\nPP-500,Cable organizer,3.00\n';
export const sampleCatalogue =
  'sku,name,cost,selling_price\nPP-100,USB-C hub,20.00,35.00\nPP-200,Laptop stand,15.00,25.00\nPP-300,Mechanical keyboard,40.00,65.00\nPP-400,Wireless mouse,12.00,20.00\n';
export function sampleWorkspace(): Workspace {
  return {
    currency: 'USD',
    catalogVersion: 0,
    suppliers: [
      {
        id: 'sample-supplier',
        name: 'Northstar Supply',
        currency: 'USD',
        rule: { mode: 'margin', percent: 35, warningPercent: 20 },
        aliases: {},
        mapping: { sku: 'Item Code', name: 'Description', cost: 'Unit Price' },
      },
    ],
    products: [
      {
        id: 'sample-1',
        sku: 'PP-100',
        name: 'USB-C hub',
        costCents: 2000,
        sellCents: 3500,
        supplierId: 'sample-supplier',
      },
      {
        id: 'sample-2',
        sku: 'PP-200',
        name: 'Laptop stand',
        costCents: 1500,
        sellCents: 2500,
        supplierId: 'sample-supplier',
      },
      {
        id: 'sample-3',
        sku: 'PP-300',
        name: 'Mechanical keyboard',
        costCents: 4000,
        sellCents: 6500,
        supplierId: 'sample-supplier',
      },
      {
        id: 'sample-4',
        sku: 'PP-400',
        name: 'Wireless mouse',
        costCents: 1200,
        sellCents: 2000,
        supplierId: 'sample-supplier',
      },
    ],
    batches: [],
  };
}
