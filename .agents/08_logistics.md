# Lieferexporte (DHL GKP CSV Export & Feedback Import)

Dieses Dokument beschreibt die Architektur und die finalen Implementierungsdetails für die Lieferexporte (Versandabwicklung) in slopware.

Ziel war ein schlanker, pragmatischer Ansatz, der ohne aufwendige Artikelgewichte auskommt und vollkompatibel mit den realen Logistikabläufen (DHL Geschäftskundenportal / GKP) arbeitet.

---

## 1. Datenmodell & Schema

Wir haben zwei neue, sauber isolierte Tabellen eingeführt: `documentShipment` (Sendungs-Snapshot pro Beleg) und `documentShipmentPackage` (1..n Pakete pro Sendung mit individuellem Gewicht).

### Tabellen-Definitionen (`packages/db/src/schema/app.schema.ts`)

- **`documentShipment`**:
  - `documentShipmentId` (UUID, primary key, default: `uuidv7()`)
  - `tenantId` (UUID, references `tenant.tenantId`)
  - `documentId` (UUID, references `document.documentId`)
  - `shipmentStatus` (text, default: `'open'`) – Werte: `open` (bereit), `exported` (CSV exportiert), `label_created` (Label gedruckt/Tracking ID vorhanden), `shipped` (versendet), `cancelled` (storniert).
  - `carrierKey` (text, default: `'dhl'`)
  - `carrierServiceKey` (text, default: `'paket'`)
  - `trackingId` (text, optional)
  - **Snapshot der Empfängeranschrift:**
    - `recipientName` (text, not null)
    - `company` (text, optional)
    - `street` (text, not null)
    - `houseNumber` (text, not null)
    - `postalCode` (text, not null)
    - `city` (text, not null)
    - `countryCode` (char(2), default: `'DE'`)
    - `email` (text, optional)
    - `phone` (text, optional)
  - **Zeitstempel:**
    - `exportedAt` (timestamp, optional)
    - `labelCreatedAt` (timestamp, optional)
    - `shippedAt` (timestamp, optional)
    - `createdAt` (timestamp, default: `now()`)
    - `updatedAt` (timestamp, optional)

- **`documentShipmentPackage`**:
  - `documentShipmentPackageId` (UUID, primary key, default: `uuidv7()`)
  - `tenantId` (UUID, references `tenant.tenantId`)
  - `documentShipmentId` (UUID, references `documentShipment.documentShipmentId`)
  - `seq` (integer, default: `1`) – Fortlaufende Paketnummer
  - `weightKg` (numeric, default: `'1.0'`) – Paketgewicht in kg

_Indizes:_ Eindeutiger Unique-Index auf `(tenantId, documentId)` bei der Sendung, Indizes auf `documentId`, `shipmentStatus` und `documentShipmentId` zur Performance-Optimierung.

---

## 2. Datenbank-Service (`packages/db/src/services/logistics-service.ts`)

Der `LogisticsService` kapselt alle datenbankrelevanten Versandfunktionen und stellt folgende Methoden bereit:

- **`getOrCreateShipment(tenantId, documentId)`**:
  - Prüft zuerst auf ein existierendes `documentShipment`.
  - Wenn nicht vorhanden, wird der Beleg (`document`) geladen, um die Lieferadresse hierarchisch aufzulösen:
    1. Explizite Beleg-Lieferadresse (`deliveryAddressId` oder `deliveryAddress` JSONB).
    2. Falls vorhanden, primärer Ansprechpartner (`addressContact`) für E-Mail und Telefon.
    3. Fallback auf Beleg-Rechnungsadresse (`billingAddress` JSONB).
  - Straße und Hausnummer werden per Regex (`/(.*?)\s*(\d+\s*[a-zA-Z]?-?\d*)$/`) intelligent aus der kombinierten Straßenzeile extrahiert.
  - Legt initial 1 Standardpaket (`documentShipmentPackage`) mit `seq: 1` und `weightKg: '1.0'` an.
- **`getShipmentWithPackages(tenantId, documentId)`**:
  - Lädt die Sendung sowie alle verknüpften Pakete, aufsteigend sortiert nach `seq`.
- **`updateShipment(tenantId, documentId, data)`**:
  - Aktualisiert die editierbaren Felder des Adress-Snapshots, Status oder Dienstleister.
  - Arbeitet als echtes Upsert-Verhalten: wenn noch keine Sendung existiert, wird sie aus dem Dokument-Kontext angelegt und die übergebenen Werte werden direkt gespeichert.
  - Validiert Pflichtfelder vor dem Persistieren. Unvollständige Adressdaten führen zu einem 400-fähigen Fehler statt zu Platzhalterwerten.
- **`savePackages(tenantId, documentShipmentId, packageLines)`**:
  - Aktualisiert die Pakete einer Sendung atomar (Löschen aller bisherigen Pakete und Neueinfügen der neuen Liste) innerhalb einer Datenbanktransaktion.
  - Pakete werden normalisiert und validiert; die Sendung kann nicht ohne mindestens ein gültiges Paket persistiert werden.
- **`exportShipmentsCSV(tenantId, documentIds)`**:
  - Löst Sendungs-Snapshots für alle übergebenen Dokumente auf.
  - Generiert eine DHL GKP-konforme, semicolon-separierte CSV-Zeilenliste.
  - _Multi-Paket-Handling:_ Pro Paket einer Sendung wird eine separate Zeile in der CSV exportiert (mit identischer Belegnummer als Referenz, aber individuellem Paketgewicht).
  - Setzt den Status aller exportierten Dokumente auf `exported` und `exportedAt = now()`.
  - Bricht mit einem Fehler ab, wenn ein Dokument oder eine Sendung nicht sauber auflösbar ist, statt stille Ersatzwerte zu verwenden.
- **`importTrackingCSV(tenantId, csvContent)`**:
  - Parst die hochgeladene DHL-Rückspiel-CSV flexibel (case-insensitive Erkennung der Belegnummer und Tracking-ID Spalten).
  - Der Parser ist quote-sensitiv und verarbeitet semikolongetrennte Zeilen mit eingebetteten Anführungszeichen robuster als ein simples `split(";")`.
  - Aktualisiert die entsprechenden Sendungen auf den Status `label_created` mit der entsprechenden `trackingId` und `labelCreatedAt = now()`.

---

## 3. TanStack Start API-Routen

- **`GET /api/documents/$documentId/shipment`**:
  - Holt oder erstellt die Sendungsdaten und verknüpften Pakete.
- **`POST /api/documents/$documentId/shipment`**:
  - Aktualisiert den Adress-Snapshot, Status sowie die Liste der Pakete und Gewichte.
  - Gibt bei unvollständigen Adressdaten oder ungültigen Paketen einen 400-Fehler zurück.
- **`POST /api/documents/export`**:
  - Akzeptiert `{ documentIds: string[] }` im JSON-Body.
  - Führt `exportShipmentsCSV` aus und liefert die generierte CSV-Datei als Download-Response (`Content-Type: text/csv`, `Content-Disposition: attachment; filename="dhl_export.csv"`).
- **`POST /api/documents/import-tracking`**:
  - Akzeptiert Multipart-Form-Uploads einer DHL-Feedbackdatei oder rohen CSV-Text.
  - Parst die Datei, ordnet die Sendungen zu und liefert die Anzahl aktualisierter Belege zurück.

---

## 4. Frontend UI-Integration (`apps/web/src/routes/_auth/app/documents.tsx`)

### Grid-Mehrfachauswahl & Bulk Actions

Das Dokumenten-Grid wurde um die Eigenschaft `selectable` und eine Bulk-Aktion erweitert:

- **Bulk Action: "Versand-CSV (DHL GKP)"**
  - Triggert einen POST-Request an `/api/documents/export` mit den ausgewählten IDs.
  - Verarbeitet die Antwort als Datei-Blob und löst clientseitig den Download der `dhl_export.csv` aus.
  - Aktualisiert anschließend reaktiv die Belegliste.

### ActionBar Command: "DHL-Tracking importieren"

- Registrierung des Commands `import-tracking-csv` im globalen Command-System (`CommandProvider`).
- Bietet einen Button in der ActionBar, der einen unsichtbaren, dynamischen `<input type="file" accept=".csv" />` öffnet.
- Lädt die ausgewählte CSV-Datei per `FormData` zum Server hoch und gibt nach erfolgreichem Import eine Feedback-Meldung via Toast aus.

### Inspector-Panel: Tab "Versand"

Im Inspector-Tab-Panel neben den Belegzeilen und Belegdetails wurde der Tab **Versand** integriert:

- **Status-Badge:** Zeigt den aktuellen Paketstatus farblich markiert an.
- **Dienstleister-Wahl:** Feste Selects zur Auswahl des Carriers (`dhl`) und Produkt-Typs (`paket`).
- **Tracking-ID:** Eingabefeld für die Trackingnummer. Bei vorhandener Tracking-ID wird ein anklickbarer Link mit Icon zur DHL-Sendungsverfolgung eingeblendet.
- **Adress-Snapshot:** Vollständige, barrierefreie Eingabemasken für Name, Firma, Straße, Hausnummer, PLZ, Ort und Kontaktfelder (E-Mail, Telefon).
- **Pakete & Gewichte:**
  - Zeigt die Liste aller Pakete mit Sequence-Nummern an.
  - Ermöglicht die freie Eingabe des Gewichts für jedes einzelne Paket.
  - Bietet Buttons zum Hinzufügen neuer Pakete (Standard: 1.0 kg) und Löschen von Zeilen.
  - Mindestens ein Paket bleibt immer erhalten; die UI verhindert das Entfernen des letzten Pakets.
  - Zeigt im Header ein live berechnetes, schickes Gesamtgewichts-Badge (Summe aller Pakete).
- **Speichern:** Der Button „Versand speichern“ sichert den gesamten Snapshot und die Paketliste in einem Rutsch über den `/shipment` POST-Endpunkt.
  - Die Oberfläche ist sprachlich konsistenter auf Deutsch ausgelegt und nutzt im Versandbereich keine freien Carrier-/Service-Textfelder mehr.
