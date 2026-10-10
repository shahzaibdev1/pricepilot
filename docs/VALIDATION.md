# Validation record

Date: 10 October 2026. Environment: Windows, Node.js 22.22, Next.js 16.4, local Supabase with PostgreSQL 17, real Chromium.

Completed verification: **71 automated tests passed** — 51 unit, 5 database integration and 15 production browser scenarios.

| Area                      | Evidence                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pricing                   | Decimal arithmetic, markup vs gross margin, upward cent rounding, positive prices and explicit number separators covered by unit tests.                                                                           |
| Files                     | CSV quoting/BOM/semicolon parsing, header errors, XLSX formulas, formatted leading-zero SKUs, sheet selection and instruction-sheet skip notices covered by unit and browser tests.                               |
| Matching and review       | Exact SKUs, supplier aliases, duplicate/alias collision blocking, invalid rows, warnings, explicit approval, atomic apply, repeat-apply protection and stale catalogue detection covered by domain tests.         |
| Catalogue and suppliers   | Real browser supplier creation, pricing configuration, aliases, catalogue import/searchable table, preserved SKUs and pagination after deletion.                                                                  |
| Persistence and isolation | Real Supabase signups; private workspaces; anonymous RPC and direct-write denial; saved state survives reads; concurrent saves allow one winner; malformed state and negative catalogue revisions rejected.       |
| Authentication            | Production Chromium signup, protected-route redirect, sign-in errors, sign-out/sign-in, password change and an actual local recovery email/link/password change.                                                  |
| End-to-end updates        | Supplier upload → mapping → review → approval → apply → CSV contents → reload → history. Real account persists changes; browser-local demo protects against stale-tab overwrites.                                 |
| Recurring use             | Confirmed history removal preserves catalogue prices and frees saved-update capacity. A real account saves a 5,000-row, 100-column supplier file and applies one selected product.                                |
| Interface                 | Desktop/mobile screenshots inspected. Mobile overview has no page overflow. Main-screen and review WCAG A/AA automated scans return no violations. Keyboard Escape closes the supplier dialog and restores focus. |
| Build and dependencies    | ESLint, strict TypeScript, formatting and optimized Next.js production build pass. npm audit reports zero known vulnerabilities.                                                                                  |

The fresh independent code review found three important issues: a cover sheet rejected valid XLSX data, unused columns inflated save requests, and saved-update slots could never be reclaimed. All were fixed and covered by regression tests. The reviewer reproduced the fixes and reported no remaining critical or important findings. The report's record numbering and deletion pagination were also corrected.

The final production browser suite passed all 15 scenarios in 50.7 seconds. Screenshots are in `docs/screenshots`. CI includes production browser tests and real local Supabase checks.

Limits of verification: hosted Supabase email delivery/confirmation, customer file formats, live store imports, hosting and actual buyer willingness to pay have not been tested. CI is configured but has not run on GitHub because this repository has not been published. Automated accessibility scans do not substitute for a full human accessibility audit. Test coverage provides evidence for these scenarios; it does not prove the absence of every possible defect.
