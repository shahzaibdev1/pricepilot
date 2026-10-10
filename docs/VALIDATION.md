# Validation record

Date: 10 October 2026. Environment: Windows, Node.js 22.22, Next.js 16.4, local Supabase with PostgreSQL 17, real Chromium.

Verified so far:

- 47 domain unit tests pass: monetary validation/rounding, CSV/XLSX parsing, formula escaping, exact SKU matching, duplicate/alias collision blocking, approval, immutable/atomic apply, stale review detection, command validation and supplier/catalogue operations.
- 5 real Supabase integration tests pass: signed-up users have separate workspaces; anonymous RPC and direct writes are denied; saved state survives reads; concurrent writes permit exactly one winner; malformed state and negative catalogue revisions are rejected.
- The production build has passed.
- Real browser account creation, supplier update/review/apply, Supabase reload persistence, password change/sign-out/sign-in, catalogue import, SKU aliases, CSV contents, responsive layout, login errors and reset requests have passed.
- Dependency audit reports zero known vulnerabilities after updating the spreadsheet UUID dependency and removing the vulnerable development glob dependency chain.

The final full browser run, production-server checks, visual review and independent code review are being completed. This file will be updated with their actual outcomes before handoff.

Limits of verification: hosted Supabase email delivery, customer file formats, live store imports, hosting and actual buyer willingness to pay have not been tested. CI is configured but has not run on GitHub because this repository has not been published. Automated accessibility scans do not substitute for a full human accessibility audit.
