# PricePilot implementation plan

> **For agentic workers:** Use native implementation and a fresh reviewer at completion; user requested immediate delivery and saving tokens.

**Goal:** Deliver a usable supplier update application.
**Architecture:** Pure domain pipeline, server-validated actions, authenticated Supabase JSONB workspace with optimistic revision and RLS, explicitly labelled local demo. Next.js interface consumes the same domain pipeline.
**Tech Stack:** Next.js, React, TypeScript, Supabase, PapaParse, ExcelJS, Decimal.js, Vitest, Playwright.
**Spec:** ../specs/2026-10-10-pricepilot-design.md

## Global constraints

- 5 MB files, 5,000 rows; CSV/XLSX only; single workspace currency.
- No fuzzy matches or silent deletes; invalid/duplicate rows cannot apply.
- Integer cents, explicit number locale, upward selling-price rounding.
- No app service-role key; authenticated server actions and account RLS.
- Browser demo labelled local; no false cloud status.

## Review focus

- Leading-zero SKUs and spreadsheet formulas: parser and export tests.
- Same batch applied twice or catalogue edited since review: domain revision and DB concurrency tests.
- Unknown supplier SKU: explicit alias/new product and browser workflow.
- Account B cannot read or overwrite account A: real Supabase tests.
- Broken upload and stale mapping: actionable UI and browser error tests.

## Tasks

- [ ] 1. Write failing unit contracts; implement monetary parsing, CSV/XLSX parsing and exports, mapping validation, matching/review/apply with unit tests.
- [ ] 2. Write failing persistence/auth tests; implement Supabase migration, RLS, atomic versioned RPC, server auth/actions and local demo adapter; run real integration tests.
- [ ] 3. Write failing browser scenarios; implement shell, dashboard, supplier settings/aliases, catalogue import, guided supplier upload/review/export, history and login/reset screens.
- [ ] 4. Run tests and fix root causes; check keyboard accessibility/mobile, lint/types/build/audit; independent whole-app review and regression fixes.
- [ ] 5. Provide README, setup, sample files, actual validation report; launch local application and hand off with explicit hosted setup limits.
