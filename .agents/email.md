# E-Mail — Belegversand mit Vorlagen

## Überblick

Belege können per E-Mail versendet werden. Das System löst automatisch eine tenant-spezifische **Vorlage** (Betreff + HTML-Body mit `{{platzhalter}}`) anhand der Belegart, Firma, Sprache und Sende-Identity auf. Der Benutzer kann die Vorlage im Compose-Dialog manuell überschreiben.

Beide Versandwege laufen serverseitig durch dieselbe Pipeline:

```
UI / KI-Overlay
      │
      ▼
EmailDocumentService.getDocumentEmailDefaults()   ← resolve recipient, attachment, template
      │
      ▼
EmailTemplateService.render()                     ← binding resolution → placeholder render
      │
      ▼
EmailSendService.saveDraft() → confirmSend()      ← outbox + provider send
```

---

## Versandwege

### 1. Commandbar (documents.tsx)

Auslöser: Befehl „Send document by email" im Belegfenster.

Flow:
1. `GET /api/email/accounts` + `/identities` — Sende-Identity ermitteln.
2. `entityList("emailTemplate", { category: "document" })` — Vorlagen für den Dropdown laden.
3. `POST /api/email/documents/:id/compose-defaults` — Default-Empfänger, Betreff, Body und Anhang-Referenz laden (inkl. Binding-Auflösung). Antwort enthält `templateId` für die Vorauswahl.
4. Compose-Dialog öffnen. Vorlage-Dropdown: Änderung triggert neuen `compose-defaults`-Aufruf → Betreff/Body neu rendern, Composer-State aktualisieren.
5. `POST /api/email/documents/:id/prepare-send` — Draft erstellen (Outbox-Eintrag). `templateId` wird mitgesendet (für korrekte Render-Log-Verknüpfung).
6. `POST /api/email/drafts/:outboxId/send` — finaler, irreversibler Versand.

Relevante Dateien:
- `apps/web/src/routes/_auth/app/documents.tsx` — `openDocumentMail`, `changeDocumentMailTemplate`, `submitDocumentMail`, `EmailComposeDialog`-Verwendung.
- `apps/web/src/components/email/EmailComposeDialog.tsx` — Dialog mit Vorlage-Dropdown.

### 2. KI-Overlay (api/ai/$.ts)

Der KI-Pfad plant die Capability `prepare-document-email` (= `communication.emailOutbox.prepareSend`). Da `EmailDocumentService` durch dieselbe Render-Pipeline läuft, greift die Binding-Auflösung automatisch, sobald Vorlagen existieren — ohne zusätzlichen Aufwand.

---

## Vorlage-System

### Datenmodell

```
email_template          – Vorlage (Betreff + Body als {{platzhalter}}-Strings)
    1 : N
email_template_binding  – Bindung an einen Kontext (Belegart, Firma, Sprache, Identity)
    └─ used by ──▶ email_template_render_log  (immutable Audit-Log)
```

Detaillierte Spaltenbeschreibungen:
- [email_template](schema/email_template.md)
- [email_template_binding](schema/email_template_binding.md)
- [email_template_render_log](schema/email_template_render_log.md)

### Binding-Auflösung

`EmailTemplateService.resolveTemplate` (Pfad: `packages/db/src/services/email/template-service.ts`):

1. Alle Bindings des Tenants mit passender Category laden, wobei jedes nullable Feld entweder übereinstimmt ODER `null` ist.
2. Absteigende Sortierung nach **Spezifizität** (Anzahl nicht-null Felder), dann aufsteigend nach `priority`, dann `created_at`.
3. Erste Zeile = Gewinner.

Ergebnis: Ein `document_type=null`-Binding ist der generische Fallback; ein Binding mit `document_type='N'` gewinnt für Angebote.

### Placeholder-Engine

`renderString(template, data)` in `template-service.ts` (Server) / `renderTemplatePreview(template, data)` in `packages/ui/lib/template-preview.ts` (Client-Mirror für Live-Vorschau) — beide identisch: `{{pfad.zu.wert}}` mit Punktnotation für verschachtelte Objekte.

### Verfügbare Variablen (category=document)

| Token | Quelle |
| :--- | :--- |
| `documentNo` | `document.documentNo` |
| `documentType` | `document.documentType` |
| `documentLabel` | `[type] [no]` zusammengesetzt |
| `attachmentFileName` | `[documentNo].pdf` |
| `company.name` | `company.name` |
| `customer.companyName/firstName/lastName` | `address.*` |
| `recipientName` | Firmen- oder Personenname |
| `recipientEmail` | Primary contact email |
| `document.*`, `customer.*`, `company.*` | beliebige Felder |

---

## Admin-Route: Vorlagen pflegen

Route: `/app/email-templates`

- Linke Spalte: Liste aller `emailTemplate`-Einträge.
- Rechte Spalte: `EntityMask` für Template (CRUD), darunter Live-Vorschau mit Beispieldaten und Variablen-Hilfe-Panel, dann `EntityMask` für Binding + Binding-Grid.
- Shortcuts: F3 = Neue Vorlage, F4 = Neues Binding.
- EntityMask speichert über `communication.emailTemplate.create/update/archive`.

---

## Capabilities

| Entität | Operation | Key |
| :--- | :--- | :--- |
| emailTemplate | list | `communication.emailTemplate.list` |
| emailTemplate | get | `communication.emailTemplate.get` |
| emailTemplate | create | `communication.emailTemplate.create` |
| emailTemplate | update | `communication.emailTemplate.update` |
| emailTemplate | archive | `communication.emailTemplate.archive` |
| emailTemplateBinding | list | `communication.emailTemplateBinding.list` |
| emailTemplateBinding | get | `communication.emailTemplateBinding.get` |
| emailTemplateBinding | create | `communication.emailTemplateBinding.create` |
| emailTemplateBinding | update | `communication.emailTemplateBinding.update` |
| emailTemplateBinding | archive | `communication.emailTemplateBinding.archive` |
| emailTemplateRenderLog | list | `communication.emailTemplateRenderLog.list` |
| emailTemplateRenderLog | get | `communication.emailTemplateRenderLog.get` |
| emailOutbox | composeDefaults | `communication.emailOutbox.composeDefaults` |
| emailOutbox | prepareSend | `communication.emailOutbox.prepareSend` |
| emailOutbox | confirmSend | `communication.emailOutbox.confirmSend` |

---

## Seed-Vorlagen (Tenant `base`)

Skript: `packages/db/src/scripts/seed-email-templates.ts` (idempotent).

Vorlagen je Belegart (category `document`, language `de`):

| Code | Name | Belegart | Betreff-Vorlage |
| :--- | :--- | :--- | :--- |
| `document-N` | Angebot | N | `{{company.name}}: Angebot {{documentNo}}` |
| `document-A` | Auftragsbestätigung | A | `{{company.name}}: Auftragsbestätigung {{documentNo}}` |
| `document-L` | Lieferschein | L | `{{company.name}}: Lieferschein {{documentNo}}` |
| `document-R` | Rechnung | R | `{{company.name}}: Rechnung {{documentNo}}` |
| `document-G` | Gutschrift | G | `{{company.name}}: Gutschrift {{documentNo}}` |
| `document-default` | Beleg (Standard) | — | `{{company.name}}: {{documentLabel}}` |

Ausführung: `DATABASE_URL=<url> pnpm --filter @repo/db exec tsx src/scripts/seed-email-templates.ts`

> **Hinweis Belegart-Codes:** laut `document_type`-Tabelle ist N=Angebot, A=Auftrag (nicht umgekehrt).

---

## Quelldateien (Kurzreferenz)

| Bereich | Pfad |
| :--- | :--- |
| Render-Service | `packages/db/src/services/email/template-service.ts` |
| Document-Service | `packages/db/src/services/email/document-service.ts` |
| Send-Service | `packages/db/src/services/email/send-service.ts` |
| Capabilities | `packages/db/src/capabilities/modules/communication.email-template.ts` |
| Capabilities | `packages/db/src/capabilities/modules/communication.email.ts` |
| Admin-Route | `apps/web/src/routes/_auth/app/email-templates.tsx` |
| Compose-Dialog | `apps/web/src/components/email/EmailComposeDialog.tsx` |
| Belegversand (UI) | `apps/web/src/routes/_auth/app/documents.tsx` |
| Client-Renderer | `packages/ui/lib/template-preview.ts` |
| Seed | `packages/db/src/scripts/seed-email-templates.ts` |
