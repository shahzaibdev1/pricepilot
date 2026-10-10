export type Currency = 'USD' | 'EUR' | 'GBP' | 'PKR' | 'CAD' | 'AUD';
export type Mapping = { sku: string; name: string; cost: string };
export type PricingRule = { mode: 'markup' | 'margin'; percent: number; warningPercent: number };
export type Supplier = {
  id: string;
  name: string;
  currency: Currency;
  rule: PricingRule;
  mapping?: Mapping;
  aliases: Record<string, string>;
};
export type Product = {
  id: string;
  sku: string;
  name: string;
  costCents: number;
  sellCents: number;
  supplierId: string;
};
export type ParsedFile = {
  sheets: { name: string; headers: string[]; rows: Record<string, string>[] }[];
  warnings?: string[];
};
export type ReviewRow = {
  id: string;
  sourceRow: number;
  sourceSku: string;
  sku: string;
  name: string;
  costCents: number | null;
  sellCents: number | null;
  oldCostCents: number | null;
  oldSellCents: number | null;
  productId: string | null;
  status: 'matched' | 'new' | 'blocked';
  issues: string[];
  warnings: string[];
  approved: boolean;
};
export type Batch = {
  id: string;
  supplierId: string;
  supplierName: string;
  fileName: string;
  createdAt: string;
  status: 'review' | 'applied';
  baseCatalogVersion: number;
  rows: ReviewRow[];
  missingSkus: string[];
  appliedAt?: string;
};
export type Workspace = {
  suppliers: Supplier[];
  products: Product[];
  batches: Batch[];
  catalogVersion: number;
  currency: Currency;
};
export const emptyWorkspace = (): Workspace => ({
  suppliers: [],
  products: [],
  batches: [],
  catalogVersion: 0,
  currency: 'USD',
});
