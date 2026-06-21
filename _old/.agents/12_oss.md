# 12 - EU VAT / OSS Tax Policy

Planungsdokument fuer die naechste Steuer-Ausbaustufe nach `11_tax_refactor.md`.

Der Tax-Refactor hat die technische Grundlage gelegt: `tax_rule` wird zentral
aufgeloest, Belegzeilen speichern echte `tax_code`-IDs, Lieferland-Kontext
fliesst in die Preis-/Steuerermittlung ein, und Diagnosefelder werden auf
Belegzeilen persistiert. Dieses Dokument beschreibt die bewusst noch offene
Policy-Schicht fuer EU-B2B/B2C, innergemeinschaftliche Lieferungen,
OSS-Verhalten und Drittland-Export.

---

## Problem

Die bestehende Steuerauflösung kann anhand von Kundesteuerklasse,
Artikelsteuerklasse, Land und Datum eine konkrete Steuerregel finden. Sie
entscheidet aber noch nicht, welche steuerliche Fallgruppe vorliegt.

Offene Fragen:

- Ist der Geschaeftsfall B2B oder B2C?
- Ist die Lieferung Inland, EU-Ausland oder Drittland?
- Darf eine innergemeinschaftliche Lieferung steuerfrei behandelt werden?
- Greift OSS mit Lieferland-/Bestimmungslandbesteuerung?
- Was passiert bei fehlender oder ungueltiger USt-ID?
- Welche Steuerregistrierungen hat der Verkäufer in welchen Ländern?

Diese Entscheidungen duerfen nicht in UI-Komponenten oder Client-Payloads
wandern. Sie muessen serverseitig, tenant-scoped und testbar passieren.

---

## Ziele

- Eine explizite Tax-Policy-Schicht vor der bestehenden `tax_rule`-Auflösung.
- B2B/B2C, EU, OSS und Export als nachvollziehbare Policy-Klassifikationen.
- Keine implizite Vermischung von USt-ID-Validierung, Tax Classes und Tax Codes.
- `tax_rule` bleibt das ausführbare Mapping auf konkrete `tax_code`-IDs.
- Fehlende Regeln oder unvollständiger Kontext liefern kontrollierte Diagnosen.
- Preisermittlung, Belegeditor und Commerce-Import nutzen dieselbe Serverlogik.

## Nicht-Ziele

- Externe USt-ID-Validierung gegen VIES im ersten Schritt.
- Vollstaendige rechtliche Abdeckung aller EU-Sonderfaelle.
- Incoterms, Dreiecksgeschaefte, Reverse-Charge-Sonderbranchen.
- Historische Migration alter Belegzeilen.
- Steuerberater- oder Rechtsberatung im Code abbilden.

---

## Begriffe

| Begriff             | Bedeutung                                                                    |
| ------------------- | ---------------------------------------------------------------------------- |
| Seller Country      | Sitzland der verkaufenden Firma, aktuell `company.country_code`.             |
| Billing Country     | Land der Rechnungsadresse des Kunden.                                        |
| Delivery Country    | Land der Lieferadresse; fuer Sales-Tax-Kontext primaer.                      |
| Destination Country | Steuerlich verwendetes Bestimmungsland, meist Delivery Country.              |
| B2B                 | Kunde gilt als Unternehmer. Fuer EU-Steuerfreiheit nur mit gueltiger USt-ID. |
| B2C                 | Kunde gilt als Endkunde oder nicht ausreichend als B2B validiert.            |
| Intra-community B2B | EU-Auslandslieferung an Unternehmer mit gueltiger USt-ID.                    |
| OSS                 | One-Stop-Shop; Verkäufer versteuert EU-B2C im Bestimmungsland.               |
| Export              | Lieferung in ein Drittland ausserhalb der EU.                                |
| Tax Class           | Klassifikator fuer Kunden/Artikel. Kein buchbarer Steuerkey.                 |
| Tax Code            | Konkreter Steuerkey mit Satz; darf auf Belegzeilen gespeichert werden.       |
| Tax Rule            | Tenant-scoped Mapping von Policy-/Tax-Class-Kontext auf Tax Code.            |

---

## Aktueller Stand

Vorhandene Grundlagen:

- `packages/db/src/services/tax-resolution-service.ts`
  - loest `tax_rule` tenant-scoped, datums- und laenderbezogen auf.
  - priorisiert spezifische Kundenklasse und spezifisches Land.
  - gibt `taxCodeId`, `taxRate`, `ruleId`, `countryCodeUsed` und `reason` zurueck.
- `packages/db/src/services/document-service.ts`
  - `resolveVariantPricing()` fragt den Resolver an.
  - Delivery Address Country wird serverseitig geladen.
- `packages/db/src/capabilities/modules/sales.document.ts`
  - Pricing-/Refresh-Capabilities transportieren Steuerdiagnosen.
- `packages/ui/components/document-editor.tsx`
  - sendet Billing-/Delivery-Kontext an die Server-Pricing-Funktion.
  - zeigt stale Tax Context und erlaubt Refresh.
- Schema-Grundlagen:
  - `company.country_code`, `company.vat_id`
  - `address.country_code`, `address.vat_id`, `address.tax_class_id`
  - `delivery_address.country_code`
  - `country.is_eu`
  - `tax_class`, `tax_code`, `tax_rule`

Fehlend:

- explizite Verkäufer-Steuerregistrierungen pro Land.
- OSS-Teilnahme/Gueltigkeit.
- persistierter VAT-ID-Validierungsstatus.
- zentrale Policy-Klassifikation vor dem `tax_rule`-Lookup.

---

## Policy-Entscheidungen

Diese Defaults gelten fuer die erste Implementierung, bis ein ADR sie ersetzt.

### 1. B2B/B2C

B2B/B2C wird serverseitig bestimmt. Die UI darf keine finale Tax-Policy
vorgeben.

Erste Regel:

1. `address.taxClassId` bleibt der manuelle Stammdaten-Hinweis.
2. Eine EU-B2B-Steuerfreiheit erfordert zusaetzlich eine als gueltig bekannte
   USt-ID.
3. Ohne gueltige USt-ID wird nicht steuerfrei innergemeinschaftlich behandelt.

Der erste Schritt darf USt-IDs als `unknown` behandeln. `unknown` ist nicht
gleich `valid`.

### 2. Fehlende oder ungueltige USt-ID

Fehlende, unbekannte oder ungueltige USt-ID blockiert im Draft nicht den Beleg.
Sie verhindert aber die steuerfreie innergemeinschaftliche B2B-Klassifikation.

Fallback:

- EU-B2C mit OSS-Registrierung: Destination-Country-VAT.
- EU-B2C ohne OSS-Registrierung: definierte Fallback-Policy mit Diagnose.
- Inland: normale Inlandsteuer.
- Drittland: Export-Policy, sofern Lieferland Drittland ist.

### 3. OSS

OSS ist Verkäufer-Policy, nicht Kunden-Policy.

OSS greift nur, wenn:

- Seller Country ist EU.
- Delivery Country ist EU.
- Delivery Country ist nicht Seller Country.
- Kunde ist B2C oder nicht als gueltiger EU-B2B validiert.
- Verkäufer hat fuer den Zeitpunkt eine aktive OSS-Registrierung.

Wenn OSS nicht aktiv ist, darf die Software nicht stillschweigend eine
Bestimmungslandsteuer annehmen. Sie muss eine eigene Klassifikation
`eu-b2c-non-oss` mit Diagnose liefern.

### 4. Land-Prioritaet

Sales-Dokumente verwenden:

```ts
taxCountry = deliveryCountryCode ?? billingCountryCode ?? customerCountryCode;
```

Das verwendete Land wird weiterhin als Diagnose gespeichert.

### 5. Fehlende Tax Rule

Fehlende Regeln liefern:

- `taxCodeId: null`
- `ruleId: null`
- Policy-Klassifikation
- Diagnose/Warnung

Draft-Speichern bleibt erlaubt. Posting oder Finalisierung kann spaeter
strenger werden.

---

## Zielarchitektur

Die Steuerlogik wird in drei Schichten getrennt.

### 1. TaxContextService

Laedt Rohkontext tenant-scoped aus der Datenbank.

Input:

```ts
type BuildTaxContextInput = {
  tenantId: string;
  companyId?: string | null;
  documentDate: string;
  customerId: string | null;
  billingCountryCode: string | null;
  deliveryCountryCode: string | null;
  deliveryAddressId?: string | null;
  articleTaxClassId: string | null;
  documentType?: string | null;
};
```

Output:

```ts
type TaxContext = {
  tenantId: string;
  documentDate: string;
  sellerCountryCode: string | null;
  sellerVatId: string | null;
  customerId: string | null;
  customerTaxClassId: string | null;
  customerVatId: string | null;
  customerVatStatus: "unknown" | "valid" | "invalid" | "missing";
  billingCountryCode: string | null;
  deliveryCountryCode: string | null;
  taxCountryCode: string | null;
  sellerCountryIsEu: boolean | null;
  taxCountryIsEu: boolean | null;
  hasActiveOssRegistration: boolean;
  hasActiveDestinationVatRegistration: boolean;
  articleTaxClassId: string | null;
};
```

### 2. TaxPolicyService

Klassifiziert den Kontext. Keine DB-Schreibzugriffe.

Output:

```ts
type TaxPolicyClassification =
  | "domestic"
  | "intra-community-b2b"
  | "eu-b2c-oss"
  | "eu-b2c-non-oss"
  | "export"
  | "unknown";

type TaxPolicyResult = {
  classification: TaxPolicyClassification;
  effectiveCustomerTaxClassId: string | null;
  taxCountryCode: string | null;
  reason: string;
  warnings: string[];
};
```

Die Policy-Schicht entscheidet nicht den konkreten `taxCodeId`. Sie liefert nur
den strukturierten Kontext fuer die Regelauflösung.

### 3. TaxResolutionService

Bleibt verantwortlich fuer `tax_rule -> tax_code`.

Erweiterung:

- akzeptiert Policy-Output oder ruft Context/Policy intern auf.
- persistiert/propagiert zusaetzliche Diagnosen:
  - `taxPolicyClassification`
  - `taxPolicyReason`
  - `taxWarnings`

Die bestehende Lookup-Logik nach Tenant, Datum, Kundenklasse, Artikelklasse und
Land bleibt die ausführbare Mapping-Schicht.

---

## Datenmodell

### Neue Tabelle: `seller_tax_registration`

Zweck: Verkäuferregistrierungen und OSS-Teilnahme pro Tenant/Firma/Land
modellieren.

Vorschlag:

```sql
create type seller_tax_registration_type as enum (
  'domestic',
  'oss',
  'foreign_vat'
);

create table seller_tax_registration (
  seller_tax_registration_id uuid primary key default uuidv7(),
  tenant_id uuid not null references tenant(tenant_id),
  company_id uuid references company(company_id),
  country_code char(2) not null,
  vat_id text,
  registration_type seller_tax_registration_type not null,
  valid_from date not null,
  valid_to date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_seller_tax_registration_lookup
  on seller_tax_registration (
    tenant_id,
    company_id,
    country_code,
    registration_type,
    valid_from
  );
```

Semantik:

- `domestic`: Verkäufer ist im Sitzland steuerlich registriert.
- `oss`: Verkäufer nimmt fuer EU-B2C am OSS-Verfahren teil.
- `foreign_vat`: Verkäufer hat eine lokale auslaendische VAT-Registrierung.

### Optional spaeter: `address_vat_validation`

Nicht Teil des ersten Schnitts, aber vorgesehen fuer externe Validierung.

```sql
create type vat_validation_status as enum (
  'unknown',
  'valid',
  'invalid'
);

create table address_vat_validation (
  address_vat_validation_id uuid primary key default uuidv7(),
  tenant_id uuid not null references tenant(tenant_id),
  address_id uuid not null references address(address_id),
  vat_id text not null,
  status vat_validation_status not null,
  checked_at timestamptz,
  source text,
  raw_response jsonb,
  created_at timestamptz not null default now()
);
```

Bis diese Tabelle existiert, gilt:

- `address.vat_id is null` => `missing`
- `address.vat_id is not null` => `unknown`
- `unknown` berechtigt nicht zu steuerfreier EU-B2B-Behandlung.

---

## Tax-Rule-Konvention

`tax_rule` soll keine implizite USt-ID- oder OSS-Logik enthalten. Stattdessen
mappt sie eine durch Policy bestimmte Kundensteuerklasse auf einen Tax Code.

Empfohlene Customer Tax Classes:

| Code               | Bedeutung                                           |
| ------------------ | --------------------------------------------------- |
| `B2C`              | Endkunde oder nicht ausreichend B2B-validiert       |
| `B2B_DOMESTIC`     | Unternehmer im Inland                               |
| `B2B_EU_VALID_VAT` | EU-Unternehmer mit gueltiger USt-ID                 |
| `EXPORT`           | Drittland-Export                                    |
| `UNKNOWN`          | Kontext unvollstaendig, nur kontrollierter Fallback |

Empfohlene Tax Codes:

| Code-Beispiel | Bedeutung                                                    |
| ------------- | ------------------------------------------------------------ |
| `DE_STD_19`   | Deutschland Standardsteuer                                   |
| `AT_STD_20`   | Österreich Standardsteuer                                    |
| `EU_IC_0`     | Innergemeinschaftliche Lieferung steuerfrei / Reverse Charge |
| `EXPORT_0`    | Drittland Export steuerfrei                                  |
| `UNKNOWN_0`   | Nur fuer explizit konfigurierte Fallbacks, nicht automatisch |

Beispiel-Regeln:

| Policy              | Customer Class     | Country | Tax Code    |
| ------------------- | ------------------ | ------- | ----------- |
| domestic B2C DE     | `B2C`              | `DE`    | `DE_STD_19` |
| domestic B2B DE     | `B2B_DOMESTIC`     | `DE`    | `DE_STD_19` |
| EU B2B AT valid VAT | `B2B_EU_VALID_VAT` | `AT`    | `EU_IC_0`   |
| EU B2C OSS AT       | `B2C`              | `AT`    | `AT_STD_20` |
| Export CH           | `EXPORT`           | `CH`    | `EXPORT_0`  |

---

## Runtime-Regeln

### Domestic

Wenn `taxCountryCode === sellerCountryCode`:

- Klassifikation: `domestic`
- Land: Seller/Delivery Country
- Kundenklasse:
  - B2B-Hinweis vorhanden: `B2B_DOMESTIC`
  - sonst: `B2C`

### EU B2B

Wenn Seller Country EU, Tax Country EU, Tax Country != Seller Country:

- Mit gueltiger USt-ID:
  - Klassifikation: `intra-community-b2b`
  - Kundenklasse: `B2B_EU_VALID_VAT`
  - Land: Destination Country
- Ohne gueltige USt-ID:
  - nicht steuerfrei
  - weiter als EU B2C behandeln
  - Warnung: USt-ID fehlt/ungueltig/unbekannt

### EU B2C mit OSS

Wenn EU-Ausland, B2C und aktive OSS-Registrierung:

- Klassifikation: `eu-b2c-oss`
- Kundenklasse: `B2C`
- Land: Destination Country

### EU B2C ohne OSS

Wenn EU-Ausland, B2C und keine aktive OSS-Registrierung:

- Klassifikation: `eu-b2c-non-oss`
- Kundenklasse: `B2C`
- Land: Destination Country oder definierter Tenant-Fallback
- Warnung: OSS/auslaendische VAT-Registrierung fehlt

Die konkrete Fallback-Regel muss explizit als `tax_rule` vorhanden sein. Es gibt
keinen stillen Wechsel auf Inlandsteuer.

### Export

Wenn Tax Country nicht EU:

- Klassifikation: `export`
- Kundenklasse: `EXPORT`
- Land: Destination Country

---

## Integration Points

### Pricing

`DocumentService.resolveVariantPricing()` bleibt der erste produktive
Einstiegspunkt.

Soll-Zustand:

1. Artikelsteuerklasse laden.
2. TaxContext serverseitig laden.
3. Policy klassifizieren.
4. Tax Rule anhand Policy-Kontext aufloesen.
5. Ergebnis mit Diagnose zurueckgeben.

### Beleg-Refresh

Die bestehende Refresh-Aktion fuer stale Line Taxes verwendet dieselbe Pipeline.
Bei geaenderter Lieferadresse wird keine Client-Steuerlogik ausgefuehrt.

### Document Save

Beim Speichern:

- Non-null `taxCodeId` muss weiterhin tenant-scoped existieren.
- `taxRuleId` muss, wenn gesetzt, zum selben Tenant passen.
- Policy-Diagnosen duerfen gespeichert werden, aber Draft-Save nicht blockieren.

### Commerce Order Import

Shopware-Importe duerfen die Shop-Steuer nicht blind als ERP-Steuer uebernehmen.

Regel:

- Shopware-Betraege bleiben Preis-/Betragsquelle.
- ERP-Policy/Resolution bestimmt `taxCodeId`, `taxRuleId`, Diagnose und
  steuerlichen ERP-Kontext.
- Abweichungen zwischen Shopware-Steuersatz und ERP-Tax-Code werden als Warnung
  protokolliert.

### Commerce Product Sync

Produkt-Sync hat oft keine konkrete Lieferadresse.

Daher braucht er spaeter einen expliziten Sales-Channel-Tax-Kontext:

- Default-Land des Kanals.
- B2C/B2B-Default.
- OSS-Aktivitaet.
- Fallback-Tax-Rule fuer Produktpreise.

Kein Borrowing aus Dokumentannahmen.

---

## Testmatrix

### Policy Unit Tests

- Inland B2C DE -> `domestic`, `B2C`, `DE`.
- Inland B2B DE -> `domestic`, `B2B_DOMESTIC`, `DE`.
- DE Seller, AT Delivery, valid AT VAT -> `intra-community-b2b`.
- DE Seller, AT Delivery, missing VAT -> nicht `intra-community-b2b`, Warnung.
- DE Seller, AT Delivery, invalid VAT -> nicht `intra-community-b2b`, Warnung.
- DE Seller, AT Delivery, unknown VAT -> nicht `intra-community-b2b`, Warnung.
- DE Seller, AT Delivery, B2C, OSS aktiv -> `eu-b2c-oss`, Land `AT`.
- DE Seller, AT Delivery, B2C, OSS inaktiv -> `eu-b2c-non-oss`, Warnung.
- DE Seller, CH Delivery -> `export`.
- Delivery Country gewinnt gegen Billing Country.
- Fehlendes Land -> `unknown`, keine beliebige Tax Rule.

### Context Tests

- Customer Context wird tenant-scoped geladen.
- Delivery Address aus fremdem Tenant wird ignoriert.
- Seller Tax Registration aus fremdem Tenant wird ignoriert.
- Archivierte Registrierungen werden ignoriert.
- `valid_from`/`valid_to` werden beachtet.
- `country.is_eu` wird fuer Seller und Destination korrekt geladen.

### Resolution / Integration Tests

- Domestic B2C loest Inland-Standardsteuer.
- EU B2B valid VAT loest innergemeinschaftlichen 0%-Code.
- EU B2B missing/invalid VAT loest nicht den innergemeinschaftlichen 0%-Code.
- EU B2C OSS loest Destination-Country-Tax-Code.
- EU B2C ohne OSS liefert kontrollierte Diagnose bei fehlender Rule.
- Export loest Export-0%-Code.
- Fehlende Rule liefert `taxCodeId: null`, `ruleId: null`, Reason.
- `resolveVariantPricing()` gibt weiterhin echte `tax_code.tax_code_id` zurueck,
  niemals `tax_class.tax_class_id`.

---

## Implementierungsplan

### Phase 1: Dokumentation und ADR

1. Dieses Dokument als Basis verwenden.
2. Offene Policy-Defaults pruefen.
3. ADR anlegen, wenn die Defaults fachlich bestaetigt sind.

### Phase 2: Datenmodell

1. Migration fuer `seller_tax_registration_type`.
2. Migration fuer `seller_tax_registration`.
3. Drizzle Schema erweitern.
4. Seed-Daten fuer Base-Tenant:
   - DE domestic registration.
   - OSS registration.
   - Beispiel-Steuerregeln fuer DE/AT/CH.

### Phase 3: TaxContextService

1. Service-Datei anlegen.
2. Tenant-scoped Queries fuer Company, Address, Delivery Address, Country,
   Seller Tax Registrations.
3. Tests fuer Context Loading und Tenant-Isolation.

### Phase 4: TaxPolicyService

1. Reine Policy-Funktion implementieren.
2. Vollstaendige Policy-Testmatrix schreiben.
3. Noch kein UI- oder Capability-Wiring.

### Phase 5: TaxResolutionService erweitern

1. Input um Policy-Kontext erweitern oder neue Methode einfuehren.
2. Bestehende Tests beibehalten.
3. Neue Integrationstests fuer EU/OSS/Export-Regeln.
4. Result um Policy-Diagnose erweitern.

### Phase 6: Pricing und Documents verdrahten

1. `resolveVariantPricing()` auf Context -> Policy -> Resolution umstellen.
2. Pricing-Capabilities um Policy-Diagnosen erweitern.
3. Document Line Persistenz optional um neue Diagnosefelder erweitern.
4. Refresh-Stale-Taxes nutzt dieselbe Pipeline.

### Phase 7: Commerce-Kontext

1. Order-Import gegen neue Pipeline pruefen.
2. Abweichung Shopware-Steuersatz vs. ERP-Steuerdiagnose protokollieren.
3. Product-Sync spaeter mit Sales-Channel-Tax-Kontext planen.

---

## Offene Entscheidungen

- Soll VAT-ID-Status initial nur aus Stammdaten kommen oder direkt als eigene
  Tabelle modelliert werden?
- Soll `eu-b2c-non-oss` Drafts erlauben, aber Posting blockieren?
- Welche Tax-Class-Codes sind Seed-/Systemdaten und welche frei pflegbar?
- Wird `companyId` im Dokument explizit gespeichert oder aus Tenant/Base Company
  abgeleitet?
- Sollen Policy-Diagnosen auf jeder Belegzeile gespeichert werden oder reicht
  `taxReason` mit strukturierter JSON-Erweiterung?
- Wie soll Sales-Channel-Tax-Kontext fuer Product-Sync modelliert werden?

---

## Verifikation

Bei Code-Aenderungen:

- Policy-/Service-Tests zuerst ausfuehren.
- Capability-Tests nur ueber Capability-Surface oder `executeCapability`.
- `vp lint` genau einmal am Ende eines Code-Change-Turns.

Fuer reine Dokumentaenderungen ist kein Lint notwendig.
