# PricePilot — operations guide

> First-supplier walkthrough, hosted setup, release boundaries and verification commands. For the project overview, see the [README](../README.md).

A Next.js + Supabase application for turning supplier price lists into reviewed product updates.

## Start here

Requirements: Node.js 22+, Docker Desktop running with Linux containers, and npm.

```sh
npm ci
npm run setup:local
npm run dev
```

Open **http://127.0.0.1:3000**. `/demo` is a clearly labelled, browser-local sample workspace. `/login` creates a real account backed by the local Supabase database. Local email confirmation is disabled for development; reset emails appear at **http://127.0.0.1:54324**. Authentication and customer data isolation also work against a hosted Supabase project.

## What works

- Account creation, sign-in, sign-out, email password reset and password change.
- Private account workspaces protected by Supabase row-level security.
- Supplier settings, target gross margin or cost markup, cost-increase alerts, saved column mappings and explicit SKU aliases.
- CSV and XLSX upload, workbook sheet selection, visible notices for skipped invalid sheets, quoted CSV, semicolon-delimited CSV and explicit decimal separators.
- Existing catalogue import, product search, supplier filters, pagination, deletion and CSV export.
- Exact product matching with preserved leading-zero codes. Unknown SKUs require explicit approval as new products or a configured alias.
- Blocked duplicate SKUs, alias collisions, missing identifiers and invalid or formula-based costs.
- Review tables showing old/new costs, suggested selling prices, margin warnings and missing products. Missing products are never deleted automatically.
- Row selection, bulk approval of valid rows, atomic apply, stale-review protection and repeat-apply protection.
- Saved history, product-update CSV and a complete change-report CSV, with spreadsheet formula escaping. Confirmed history removal frees saved-update slots without changing catalogue prices.
- Responsive layout, keyboard-operable dialogs, labelled controls, visible validation messages and guided sample data.

## First real supplier

1. Create an account at `/login`.
2. Add the supplier and choose its pricing rules.
3. Set your workspace currency before importing products (Overview, bottom of page).
4. Import your current catalogue. A template is in `samples/catalogue.csv`; columns can have different names because you map them in the UI.
5. Start a new price update and upload the supplier's latest file.
6. Choose the sheet, map SKU/name/cost, and choose period or comma decimals.
7. Review warnings and blocked rows. Configure SKU aliases in supplier settings if the supplier uses different codes, then upload again.
8. Select the rows you approve and apply the update.
9. Download the product CSV and change report.

The product CSV has `sku,name,cost,selling_price` columns. It is a generic exchange format; this release does not write directly to Shopify, an ERP or an accounting system. Adapt the export to the buyer's importer during onboarding. Prices and reports use the workspace currency; there is no foreign-exchange conversion.

Change reports use `record_number`: the one-based position among nonempty product records, rather than an original spreadsheet row or physical CSV line number. Download reports before removing saved updates in History; removal deletes the saved review/report and keeps catalogue products and prices.

## Hosted setup

1. Create a Supabase project you own.
2. Apply `supabase/migrations/202610100001_workspaces.sql` using the Supabase SQL editor or `supabase db push` after linking the project.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL=https://your-domain` in your hosting environment. Use the project publishable key; never use a secret/service-role key in this app. The app URL must exactly match the browser origin so authentication redirects retain the session cookie.
4. Configure the Supabase Auth site URL and allow `https://your-domain/auth/callback` as a redirect URL. Email templates must retain the supplied redirect URL so password resets return to `/auth/callback?next=/reset`.
5. Enable email confirmation and configure a production SMTP provider in Supabase for public customer accounts. The local settings intentionally disable confirmation for tests.
6. Set environment variables **before building** and deploy this standard Next.js application to a compatible Node.js hosting service.
7. Run a smoke test against the deployed project: account creation, confirmation email, supplier/catalogue import, reviewed update, reload, export and password reset.

No hosted Supabase project or public deployment was provisioned by this build. `.env.local` points to the tested local Supabase instance and is ignored by Git.

## Verification

```sh
npm run verify                 # ESLint, TypeScript, unit tests, production build
npm run test:integration       # real local Supabase: auth, RLS and save concurrency
npm run test:e2e               # real Chromium: local demo and authenticated workflows
npm run test:e2e:production    # same browser suite against next start after npm run build
npm run format:check
npm audit
```

See `docs/VALIDATION.md` for actual results and scope. Browser tests need the local stack configured with `npm run setup:local`. Test accounts use unique `@example.com` addresses and remain in your local development database. Reset the development database using `npm run db:reset` only when you want to remove its data. Stop the stack using `npm run db:stop`.

## Boundaries of this release

- 5 MB per uploaded file, 5,000 rows per sheet, 100 columns, 5,000 catalogue products, 100 suppliers, 500 SKU aliases per supplier and 50 saved updates.
- Only mapped product columns are sent to the server. Expanded mapped data must also fit within 5 MB; split unusually large compressed worksheets into smaller files. Invalid workbook sheets are skipped with visible notices when other readable sheets exist.
- One private workspace per account, one currency, two-decimal monetary units. USD, EUR, GBP, PKR, CAD and AUD are supported.
- Files are parsed in the browser; original supplier files are not uploaded or stored. Reviewed rows and business data are saved to Supabase.
- CSV files must be UTF-8. XLSX formulas are never evaluated; formula-based costs are blocked. Convert formula prices to values first.
- No PDF/OCR, fuzzy matching, inventory updates, billing, team invitations or live store integrations.
- Browser demo data belongs to this browser profile and is not cloud-backed. Its storage is limited to approximately 4 MB.
- JSONB workspace storage and optimistic versioning deliberately keep this initial release small. Larger tenants should move to normalized product/batch tables and background jobs.

## Project structure

`src/lib/domain` owns monetary rules, parsing, review and commands. `src/lib/workspace-actions.ts` authenticates and validates every mutation. `supabase/migrations` contains RLS and atomic versioned persistence. `src/components` contains the guided interface. `tests/unit`, `tests/integration` and `tests/e2e` cover their respective boundaries. Design decisions and implementation plan live in `docs/superpowers`.

Superpowers skills were installed from [obra/superpowers](https://github.com/obra/superpowers); planning, test-first development, code review and verification guidance informed this implementation.
