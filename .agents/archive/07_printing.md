# 07 — Document Printing

## Goal

Generate tenant-scoped PDFs for all 13 ERP document types on demand. The print button triggers a server-side render — no client-side PDF generation, no headless browser process.

## Architecture Decisions

| Decision             | Choice                                        | Rationale                                                                                          |
| -------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Template strategy    | Single parametrised React component           | All 13 types share the same layout (header, positions table, totals, footer); type label is a prop |
| PDF engine           | `@react-pdf/renderer` v3                      | Runs in the Node.js process directly — no browser binary, no queue, no timeout management          |
| Tenant customisation | Deferred (v2+)                                | v1 draws company data from the `company` table; no `print_config` table, no logo upload            |
| Print UX             | `GET /api/documents/:id/print` → PDF download | No in-app preview step; filename is `{typeLabel}-{documentNo}.pdf`                                 |
| Trigger              | F6 shortcut + CommandRegistry                 | Consistent with existing F9/F10 keyboard-first pattern; no ad-hoc keydown handlers                 |

## Architecture Invariants

- PDF rendering happens **server-side only** — `renderToBuffer` is called in the TanStack Start API route handler.
- `document-pdf.tsx` uses **`@react-pdf/renderer` primitives exclusively** (`Document`, `Page`, `View`, `Text`, `StyleSheet`). It must never import React DOM components, Tailwind classes, or HTML elements.
- Styling uses a single top-level `StyleSheet.create()` — no scattered inline style objects.
- Fonts are built-in only: `Helvetica` / `Helvetica-Bold`. No external font registration.
- The route is **tenant-scoped**: all three DB queries (`document`, `documentLine`, `company`) include `eq(table.tenantId, context.tenantId)`.

---

## What Is Already Done — Do Not Rebuild

### 7.A Dependency

- [x] **7.A1** `pnpm-workspace.yaml` catalog: `"@react-pdf/renderer": "^3.4.0"`
- [x] **7.A2** `apps/web/package.json` dependencies: `"@react-pdf/renderer": "catalog:"`
- [x] **7.A3** `pnpm install` completed — no peer warnings

### 7.B PDF Component

**File:** `apps/web/src/pdf/document-pdf.tsx`

- [x] **7.B1** Exports:
  - `DocumentLine` — interface for a single line row
  - `DocumentForPrint` — document header + `lines: DocumentLine[]`
  - `CompanyForPrint` — sender fields drawn from the `company` table
  - `DocumentPDFProps` — `{ doc, company, typeLabel }`
  - `TYPE_LABELS` — `Record<string, string>` covering all 15 type codes (N/A/L/R/G/b/l/r/g/V/Z/E/U/q/p)
  - `default` export: `DocumentPDF` component

- [x] **7.B2** Formatting helpers:
  - `formatDate(s)` — ISO `YYYY-MM-DD` → `DD.MM.YYYY`
  - `formatNum(s, decimals?)` — German number format (`.` thousands, `,` decimal)
  - `fmtAmt(s, currency)` — `formatNum` + space + currency code

- [x] **7.B3** Layout (A4, margins top/left/right 2cm, bottom 2.5cm):
  - **Header row** (`flexDirection: row`, `justifyContent: space-between`):
    - Left (~55%): company name (bold 11pt), address lines, VAT-ID + Steuernummer (8pt muted)
    - Right (~40%, text-align right): typeLabel (bold 14pt), documentNo (bold 11pt, blue `#2563eb`), documentDate formatted
  - **HR divider** (1pt border, `#e5e7eb`, margin 12pt vertical)
  - **Billing address block** (~55%): companyName/name, addressLine1/2, postalCode + city
  - **Delivery address block** (conditional — shown only when `deliveryAddress` is set and differs from `billingAddress`): prefixed "Lieferadresse:", muted style
  - **Positions table** (margin top 16pt):
    - Header row: background `#f1f5f9`, borderBottom 1pt `#e2e8f0`
    - Columns: `Pos` 5% · `Bezeichnung` 45% · `Menge` 10% · `Einheit` 8% · `EP` 12% · `R%` 8% · `Netto` 12%
    - Article lines: `lineNo` | `articleTextSnapshot` | `quantity` | `unit` | `netPrice` | `discountPercentage%` | `lineTotalNet`
    - Comment lines (`lineType === 'comment'`): full-width italic muted text, no amount columns
    - Alternating row background: white / `#f8fafc`
  - **Totals block** (self-align flex-end, ~35% width, margin top 12pt):
    - Netto, MwSt, Brutto (bold, borderTop 1pt)
  - **Footer** (absolute bottom, borderTop 1pt, 8pt muted, `flexDirection: row`):
    - Left: company name · UID · IBAN · BIC
    - Right: email · homepage · phone

### 7.C Print Route

**File:** `apps/web/src/routes/api/documents/$documentId/print.tsx`

- [x] **7.C1** `GET /api/documents/:documentId/print` handler following the same auth/tenant pattern as `post.ts`
- [x] **7.C2** Three sequential DB queries (tenant-scoped):
  1. `document` — header fields + address JSONB
  2. `documentLine` — all lines `ORDER BY line_no ASC`
  3. `company` — sender info via `doc.companyId`
- [x] **7.C3** Maps Drizzle rows to `DocumentForPrint` / `CompanyForPrint` interfaces
- [x] **7.C4** `renderToBuffer(<DocumentPDF ... />)` → `Uint8Array` (wraps Buffer for `BodyInit` compatibility)
- [x] **7.C5** Response headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="{typeLabel}-{documentNo}.pdf"` (URI-encoded)
- [x] **7.C6** try/catch — 500 with `console.error` on render failure; 404 for missing document or company

### 7.D UI Integration

- [x] **7.D1** `apps/web/src/routes/_auth/app/documents.tsx`: `print-document` command registered in the main command `useEffect` block
  - `id: "print-document"` · `scope: "context"` · `group: "recordOps"` · shortcut **F6**
  - `isEnabled: (s) => !!s.recordId && s.entity === "document"`
  - `handler`: `window.open(\`/api/documents/${s.recordId}/print\`, "\_blank")`
  - Cleanup: `unregPrint()` added to return function

- [x] **7.D2** `packages/ui/components/document-editor.tsx`: same `print-document` command in a dedicated `useEffect`
  - Guard: `if (isNew) return` — not shown for new unsaved documents
  - `handler`: `window.open(\`/api/documents/${documentId}/print\`, "\_blank")`
  - Dependencies: `[registerCommand, documentId, isNew]`

---

## Roadmap — Not Yet Built

### 7.E Tenant Branding (v2)

When tenants need more than text-from-company-record:

- [ ] **7.E1** Add `logo_url text` column to the `company` table (nullable); migration + seed
- [ ] **7.E2** `document-pdf.tsx`: when `company.logoUrl` is set, render `<Image src={logoUrl} />` in the header (replace or supplement the text sender block)
- [ ] **7.E3** File upload endpoint `POST /api/company/logo` — stores file to local FS or S3, returns URL; saves to `company.logo_url`
- [ ] **7.E4** Firmenstamm SettingsView: logo upload field (drag-and-drop or file input)

### 7.F print_config (v2)

For tenant-specific layout overrides without modifying templates:

- [ ] **7.F1** New `print_config` table: `tenant_id`, `document_type` (nullable = applies to all), `show_delivery_address bool`, `show_discount_column bool`, `footer_text text`, `primary_color char(7)`, `font_size_body int`
- [ ] **7.F2** Print route: load `print_config` record for tenant + document type (fall back to type=NULL record, then to defaults)
- [ ] **7.F3** Pass config down to `DocumentPDF` as a `config` prop; conditionally render columns and override colours

### 7.G Template Registry (v3)

For full tenant-editable HTML/PDF templates:

- [ ] **7.G1** `print_template` table: `tenant_id`, `document_type`, `language`, `version_no`, `is_active`, `content jsonb` (block array), `fallback_template_id`
- [ ] **7.G2** Block-based renderer: assembles blocks (Header, AddressBlock, LineTable, Totals, Footer) from `content` JSON
- [ ] **7.G3** Admin UI: block visibility toggles, label overrides, reorder — stored back to `content` JSONB
- [ ] **7.G4** Tenant admin preview: renders HTML in iframe before committing

---

## Verification Checklist

### Dependencies

- [x] `pnpm install` — no unresolved peer deps
- [x] `pnpm lint` — 0 errors (49 pre-existing warnings, unchanged)

### Route

- [ ] `GET /api/documents/:id/print` returns 401 when unauthenticated
- [ ] Returns 404 for unknown `documentId`
- [ ] Returns 404 when company record missing for tenant
- [ ] Returns `Content-Type: application/pdf` with valid PDF bytes for a known document
- [ ] Filename in `Content-Disposition` matches `{typeLabel}-{documentNo}.pdf`
- [ ] Tenant isolation: document from tenant A is not accessible when session belongs to tenant B

### PDF Content

- [ ] Sender block shows company name, address, VAT-ID from `company` table
- [ ] Recipient block shows `billingAddress` JSONB fields
- [ ] Delivery address block appears only when `deliveryAddress` differs from billing
- [ ] Positions table: article lines show all 7 columns with correct values
- [ ] Comment lines render as full-width italic text with no amount columns
- [ ] Alternating row shading visible
- [ ] Totals block: Netto / MwSt / Brutto with `formatNum` (German comma decimal)
- [ ] `documentDate` formatted as `DD.MM.YYYY`
- [ ] All 13 type labels map correctly (e.g. type `R` → "Rechnung", type `b` → "Bestellung")
- [ ] Footer: IBAN, BIC, email present when set on company

### UI

- [ ] F6 in documents module → PDF download opens in new tab for selected document
- [ ] F6 in DocumentEditor (existing document) → PDF download opens in new tab
- [ ] F6 in DocumentEditor (new unsaved document, `documentId === "__new__"`) → no action / command disabled
- [ ] No ad-hoc `keydown` listener introduced — command goes through `CommandRegistry`
