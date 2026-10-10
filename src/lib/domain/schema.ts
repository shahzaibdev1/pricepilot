import { z } from 'zod';
const id = z.string().min(1).max(120);
export const currencySchema = z.enum(['USD', 'EUR', 'GBP', 'PKR', 'CAD', 'AUD']);
export const mappingSchema = z
  .object({
    sku: z.string().min(1).max(200),
    name: z.string().max(200),
    cost: z.string().min(1).max(200),
  })
  .strict();
const rule = z
  .object({
    mode: z.enum(['markup', 'margin']),
    percent: z.number().finite().min(0).max(1000),
    warningPercent: z.number().finite().min(0).max(1000),
  })
  .strict()
  .refine((r) => r.mode !== 'margin' || r.percent < 100, {
    message: 'Gross margin must be less than 100%',
  });
export const supplierSchema = z
  .object({
    id,
    name: z.string().trim().min(1).max(120),
    currency: currencySchema,
    rule,
    mapping: mappingSchema.optional(),
    aliases: z
      .record(z.string().min(1).max(120), z.string().min(1).max(120))
      .refine((a) => Object.keys(a).length <= 500, { message: 'Maximum 500 aliases' }),
  })
  .strict();
const rows = z
  .array(z.record(z.string().max(200), z.string().max(2000)))
  .min(1)
  .max(5000);
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('supplier.save'), supplier: supplierSchema }).strict(),
  z.object({ type: z.literal('supplier.delete'), supplierId: id }).strict(),
  z.object({ type: z.literal('currency.set'), currency: currencySchema }).strict(),
  z
    .object({
      type: z.literal('catalogue.import'),
      supplierId: id,
      separator: z.enum(['.', ',']),
      rows: z
        .array(
          z
            .object({
              sku: z.string().max(120),
              name: z.string().max(300),
              cost: z.string().max(100),
              sell: z.string().max(100).optional(),
            })
            .strict(),
        )
        .min(1)
        .max(5000),
    })
    .strict(),
  z.object({ type: z.literal('product.delete'), productId: id }).strict(),
  z
    .object({
      type: z.literal('batch.create'),
      supplierId: id,
      fileName: z.string().min(1).max(255),
      mapping: mappingSchema,
      separator: z.enum(['.', ',']),
      rows,
    })
    .strict(),
  z
    .object({ type: z.literal('batch.approve'), batchId: id, rowIds: z.array(id).max(5000) })
    .strict(),
  z.object({ type: z.literal('batch.apply'), batchId: id }).strict(),
  z.object({ type: z.literal('batch.delete'), batchId: id }).strict(),
  z.object({ type: z.literal('sample.load') }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
const cents = z.number().int().min(1).max(10000000000);
const reviewRow = z.object({
  id,
  sourceRow: z.number().int().min(2),
  sourceSku: z.string(),
  sku: z.string(),
  name: z.string(),
  costCents: cents.nullable(),
  sellCents: cents.nullable(),
  oldCostCents: cents.nullable(),
  oldSellCents: cents.nullable(),
  productId: id.nullable(),
  status: z.enum(['matched', 'new', 'blocked']),
  issues: z.array(z.string()),
  warnings: z.array(z.string()),
  approved: z.boolean(),
});
export const workspaceSchema = z
  .object({
    currency: currencySchema,
    catalogVersion: z.number().int().min(0),
    suppliers: z.array(supplierSchema).max(100),
    products: z
      .array(
        z.object({
          id,
          sku: z.string().min(1).max(120),
          name: z.string().min(1).max(300),
          costCents: cents,
          sellCents: cents,
          supplierId: id,
        }),
      )
      .max(5000),
    batches: z
      .array(
        z.object({
          id,
          supplierId: id,
          supplierName: z.string(),
          fileName: z.string(),
          createdAt: z.string(),
          status: z.enum(['review', 'applied']),
          baseCatalogVersion: z.number().int().min(0),
          rows: z.array(reviewRow).max(5000),
          missingSkus: z.array(z.string()).max(5000),
          appliedAt: z.string().optional(),
        }),
      )
      .max(50),
  })
  .strict();
