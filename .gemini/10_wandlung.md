# 10 — Dokument-Wandlung (Conversion Hardening)

**Status**: Implementiert (2026-05-16)

---

## Design-Entscheidungen

| # | Thema | Entscheidung |
|---|---|---|
| 1 | G/g nur via Storno | `NEXT_TYPE: { R: undefined, r: undefined }` — Wandeln endet bei R/r; G/g entstehen ausschließlich als Storno-Duplikat |
| 2 | TransactionID | Selbe UUID durch gesamte Kette — `convertDocument` + `stornoDocument` kopieren `doc.transactionId` statt neue UUID zu erzeugen |
| 3 | A→b Kreuz-Verzweigung | AND-parallel möglich (n Kinder unter gleicher `transactionId`); `transactionId` ist reines Audit-Feld für Belegverlauf — kein Kopplungsmechanismus |
| 4 | Quelldokument nach Wandeln | `archivedAt = now()` — verschwindet aus Arbeitsliste, nur via `transactionId`-Query im Belegverlauf auffindbar |
| 5 | Wandeln aus Archiv | Erlaubt — für zweite Wandlung (z.B. A→b nach A→L) aus Belegverlauf heraus |
| 6 | Guard Wandeln | Blockiert `status === "cancelled"` und `archivedAt IS NOT NULL`; draft + posted erlaubt |
| 7 | Wandlungsmaske | Minimum: Quelle → Ziel, Bestätigen/Abbrechen; bei mehreren Zielgruppen: Button-Radio-Liste |
| 8 | Storno R→G | Storno ist **ausschließlich** für R→G und r→g (Rechnung → Gutschrift). Lieferscheine (L/l) und alle anderen Typen werden über **Löschen** (mit Buchungsumkehr) storniert — kein Storno-Button. R bleibt `posted` (kein `cancelled`); `stornoDocumentId` wird gesetzt; G entsteht als Draft — Operator prüft, passt ggf. Mengen an (Teilgutschrift), bucht manuell |

---

## Implementierte Änderungen

### `packages/db/src/services/document-service.ts`

**NEXT_TYPE** — R und r terminieren die Kette:
```ts
const NEXT_TYPE: Record<string, string | undefined> = {
  N: "A", A: "L", L: "R", R: undefined,
  b: "l", l: "r", r: undefined,
  ...
};
```

**getConversionCandidates** — gibt immer Kandidatenliste zurück (kein auto-convert):
- Wenn `sourceGroup.nextGroupId` gesetzt: einzelne Gruppe als Liste zurück
- Sonst: alle aktiven Gruppen mit `NEXT_TYPE[documentType]` als Liste
- Wirft bei fehlendem Nachfolgetyp: `"Keine weitere Wandlung möglich"`

**convertDocument**:
- Guard: `status === "cancelled" || archivedAt !== null` → throw
- `transactionId: doc.transactionId` (propagiert, nicht neu generiert)
- Nach Kinderzeugen: `UPDATE document SET archived_at = now()` auf Quelldokument

**stornoDocument**:
- Guard: Typ nicht in `["R", "r"]` → throw (Lieferscheine etc. über Löschen)
- Guard: `doc.stornoDocumentId` bereits gesetzt → throw `"Dieses Dokument wurde bereits storniert"`
- `transactionId: doc.transactionId` (propagiert)
- Kein `await this.postDocument(...)` — G/g bleibt als Draft
- Quelldokument: nur `stornoDocumentId` + `updatedAt` setzen, **kein** `status: "cancelled"`

### `apps/web/src/routes/api/documents/$documentId/convert.ts`

- Kein auto-convert mehr bei einzelnem Kandidaten
- Ohne `targetGroupId` im Body → gibt immer `{ candidates: [...] }` zurück
- Mit `targetGroupId` → führt `convertDocument` aus (User hat im Dialog bestätigt)

### `packages/ui/components/document-editor.tsx`

**canConvert** — Button sichtbar wenn:
- Nicht neu
- `status !== "cancelled"`
- `archivedAt` nicht gesetzt
- `documentType` nicht in `["G", "g", "R", "r"]`

**canStorno** — Button sichtbar wenn:
- `status === "posted"`
- `documentType` in `["R", "r"]` (nur Rechnungen)
- `stornoDocumentId` noch nicht gesetzt (kein Doppelstorno)

**Wandlungsmaske** — Zwei-Schritt-Mutation:
1. Klick auf "Wandeln" → `POST /api/documents/:id/convert` ohne Body → öffnet Dialog mit Kandidaten
2. User bestätigt → `POST /api/documents/:id/convert` mit `{ targetGroupId }` → Wandlung, Editor schließt

Dialog zeigt: `documentType documentNo → Zielgruppenname` (Text bei 1 Kandidat, Button-Liste bei mehreren)

---

## Invarianten

- **Transaktionssicherheit**: Quelldokument-Archivierung + Kinderzeugen in einer DB-Transaktion
- **Kein Hard Delete**: `archivedAt` statt delete; Belegverlauf via `transactionId`-Index abrufbar
- **G/g immer Draft nach Storno**: Operator ist für Buchung und eventuelle Teilgutschrift verantwortlich
- **transactionId ist immutable**: Wird bei Wandlung und Storno nur kopiert, nie überschrieben

---

---

## Duplikation

**Implementiert (2026-05-16)**

1:1-Kopie im gleichen Typ/Gruppe — neue `document_id`, neue `document_no` aus Nummernkreis der Beleggruppe, neue `transactionId` (frische Kette, kein Audit-Link zur Quelle).

### Neue Dateien / Änderungen

| Datei | Änderung |
|---|---|
| `packages/db/src/services/document-service.ts` | Methode `duplicateDocument` |
| `apps/web/src/routes/api/documents/$documentId/duplicate.ts` | POST-Route |
| `packages/ui/components/document-editor.tsx` | `duplicateMutation` + `canDuplicate` + Button |

**`duplicateDocument`**:
- Guard: `status === "cancelled"` → throw
- `transactionId: crypto.randomUUID()` (neu, kein Link zur Quelle)
- `status: "draft"`, `parentDocumentId: null`
- `archivedAt`, `cancelledAt`, `postedAt`, `stornoDocumentId` → alle `null`
- Alle Positionen kopiert, kein Eintrag in `documentLineAllocation`
- Quelldokument bleibt unverändert

**`canDuplicate`**: `!isNew && docStatus !== "cancelled"` (draft, posted, archived erlaubt)

---

## Noch offen

- [ ] Belegverlauf-Anzeige im DocumentEditor: Sidebar oder Tab der alle Dokumente mit gleicher `transactionId` zeigt (inkl. archivierter Vorläufer)
- [ ] `document_group.next_group_id` via Settings-UI konfigurierbar machen (Feld existiert im Schema, Seed fehlt)
- ~~Storno für L/l~~ — **entfällt**: Lieferscheine werden über Löschen (mit Lagerbuchungsumkehr) storniert
