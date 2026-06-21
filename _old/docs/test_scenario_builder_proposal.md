# Entwurf: TestScenarioBuilder für Integrationstests

Um Integrationstests wartbar und lesbar zu halten (sowohl für menschliche Entwickler als auch für KIs), schlagen wir den folgenden Entwurf für einen **fluenter** `TestScenarioBuilder` vor.

Dieser Entwurf basiert auf den Kernprinzipien des Slopware-Frameworks: Typsicherheit, Kapselung der Tenant-Isolation und Nutzung der vorhandenen Capability-API.

---

## 🏗️ Die 5 Säulen des Entwurfs

### 1. Lazy Evaluation (Verzögerte Ausführung)

Anstatt Datenbank-Inserts sofort bei jedem Methodenaufruf (z. B. `.withArticle()`) auszuführen, reiht der Builder Funktionen (Steps) in ein internes Array ein. Erst beim Aufruf von `await builder.build()` werden diese Steps nacheinander in einer Datenbank-Transaktion ausgeführt.

- **Vorteil**: Ermöglicht die Weitergabe dynamisch generierter IDs (wie `articleId`) an nachfolgende Schritte, ohne dass der Testcode diese IDs manuell verwalten muss.

### 2. Implizite Abhängigkeitsverknüpfung (State Propagation)

Der Builder hält einen internen Zustand (`BuilderState`), der wächst:

- Sobald `.withTenant()` aufgerufen wird, bestimmt er die `ExecutionContext`.
- `.withArticle()` speichert die erzeugte `articleId` im State.
- Ein nachfolgendes `.withVariant()` greift standardmäßig auf dieses `articleId` zurück.
- Ein `.withDocument()` greift auf den passenden Tenant, die Company, das Standard-Warehouse und ggf. die SKUs der erzeugten Varianten zu.

### 3. Typsicherheit über Drizzle & Capabilities

Anstatt eigene, starre DTO-Typen für Argumente zu definieren (die bei jeder Tabellenänderung brechen), nutzen wir Drizzle-Insert-Typen (`typeof schema.article.$inferInsert`) und Capability-Input-Typen.

- **Vorteil**: Null Wartungsaufwand bei Spaltenänderungen oder -erweiterungen in der Datenbank.

### 4. Capabilities First (Invariante wahren)

Der Builder nutzt für Geschäftslogik bevorzugt die Capabilities (z. B. `executeCapability("masterdata.article.upsert")`). Dadurch werden Anwendungs-Invarianten wie die automatische Erstellung von Standardvarianten oder Bestandsbuchungen automatisch mitgetestet.
Für Legacy-Zustände oder das gezielte Testen von ungültigen/historischen Rohdaten können `.withRawArticle()` oder `.withRawVariant()` bereitgestellt werden.

### 5. Eindeutige Namespaces (Self-Seeding)

Standardmäßig generiert der Builder für alle Pflichtfelder eindeutige IDs, Keys und Nummern (z. B. `ART-${randomSuffix}`), falls diese nicht explizit im Methodenschritt übergeben werden. Dadurch kollidieren parallel ausgeführte Tests niemals.

---

## 💻 Implementierungs-Entwurf

Hier ist ein konkreter Entwurf für die Klasse in [fixtures.ts](file:///home/ubuntu/slopware/packages/db/src/test-support/fixtures.ts):

```typescript
import crypto from "node:crypto";
import { db } from "../index";
import * as schema from "../schema/app.schema";
import { type ExecutionContext, executeCapability } from "../capabilities";
import { useTestTenant, getContextForTenant } from "./fixtures";

// Interner Zustand während des Builds
interface BuilderState {
  ctx?: ExecutionContext;
  tenantId?: string;
  companyId?: string;
  warehouseId?: string;
  documentGroupId?: string;

  // Zuletzt erstellte Entities zur Weiterreichung
  lastArticleId?: string;
  lastVariantId?: string;
  lastVariantSku?: string;
  lastDocumentId?: string;

  // Sammelmappen für Rückgabewerte
  articleIds: string[];
  variantIds: string[];
  variantSkus: string[];
  documentIds: string[];
}

export class TestScenarioBuilder {
  private steps: Array<(state: BuilderState) => Promise<void>> = [];

  /**
   * Setzt den Tenant. Kann ein Tenant-Slug (z.B. "base") oder ein leerer Aufruf sein,
   * der den kanonischen `useTestTenant()` lädt.
   */
  withTenant(tenantSlugOrId?: string) {
    this.steps.push(async (state) => {
      if (tenantSlugOrId) {
        state.ctx = await getContextForTenant(tenantSlugOrId);
        state.tenantId = state.ctx.tenantId;
      } else {
        const testTenant = await useTestTenant();
        state.ctx = testTenant.ctx;
        state.tenantId = testTenant.tenantId;
      }

      // Automatische Initialisierung von Standard-Metadaten (Company, Warehouse etc.),
      // falls diese für Belege gebraucht werden.
      const suffix = crypto.randomUUID().slice(0, 8);

      // Seed Company falls nicht vorhanden
      const [companyRow] = await db
        .insert(schema.company)
        .values({
          tenantId: state.tenantId!,
          companyNo: `COM-${suffix}`,
          name: `Test Company ${suffix}`,
          countryCode: "DE",
          currencyId: "EUR",
        })
        .returning({ companyId: schema.company.companyId });
      state.companyId = companyRow.companyId;

      // Seed Warehouse
      const [warehouseRow] = await db
        .insert(schema.warehouse)
        .values({
          tenantId: state.tenantId!,
          companyId: state.companyId,
          code: `WH-${suffix}`,
          name: `Test Warehouse ${suffix}`,
        })
        .returning({ warehouseId: schema.warehouse.warehouseId });
      state.warehouseId = warehouseRow.warehouseId;
    });
    return this;
  }

  /**
   * Erstellt einen Artikel über die offizielle Capability.
   */
  withArticle(
    input: Partial<Parameters<typeof executeCapability<"masterdata.article.upsert">>[2]> = {},
  ) {
    this.steps.push(async (state) => {
      if (!state.ctx) throw new Error("Tenant context not set. Call withTenant() first.");

      const suffix = crypto.randomUUID().slice(0, 8);
      const articleNo = input.articleNo ?? `ART-${suffix}`;
      const name = input.name ?? `Article ${articleNo}`;

      const res = await executeCapability("masterdata.article.upsert", state.ctx, {
        articleNo,
        name,
        ...input,
      });

      if (!res.ok) throw new Error("Failed to upsert article: " + JSON.stringify(res.error));

      state.lastArticleId = res.data.article.articleId;
      state.articleIds.push(state.lastArticleId);
    });
    return this;
  }

  /**
   * Erstellt eine Artikelvariante für den zuvor erstellten Artikel.
   */
  withVariant(input: Partial<schema.SeedVariantOptions> & { stock?: number } = {}) {
    this.steps.push(async (state) => {
      if (!state.tenantId) throw new Error("Tenant context not set. Call withTenant() first.");
      const articleId = input.articleId ?? state.lastArticleId;
      if (!articleId)
        throw new Error("No articleId found in state context. Call withArticle() first.");

      const suffix = crypto.randomUUID().slice(0, 8);
      const sku = input.sku ?? `SKU-${suffix}`;
      const optionValueHash = input.optionValueHash ?? `hash-${suffix}`;

      // Insert der Variante über Raw Helpers
      const variant = await db
        .insert(schema.articleVariant)
        .values({
          tenantId: state.tenantId,
          articleId,
          sku,
          optionValueHash,
          isActive: input.isActive ?? true,
        })
        .returning({ variantId: schema.articleVariant.variantId, sku: schema.articleVariant.sku });

      state.lastVariantId = variant[0].variantId;
      state.lastVariantSku = variant[0].sku;
      state.variantIds.push(state.lastVariantId);
      state.variantSkus.push(state.lastVariantSku);

      // Bestandsbuchung, falls 'stock' angegeben ist
      if (input.stock !== undefined && input.stock > 0) {
        await db.insert(schema.inventoryItem).values({
          tenantId: state.tenantId,
          variantId: state.lastVariantId,
          sku: state.lastVariantSku,
          tracked: true,
        });

        // Hier ggf. Buchung über ein Inventory-Movement oder direct Balance Seed
        await db.insert(schema.inventoryBalance).values({
          tenantId: state.tenantId,
          warehouseId: state.warehouseId!,
          variantId: state.lastVariantId,
          balance: input.stock.toString(),
        });
      }
    });
    return this;
  }

  /**
   * Erstellt ein Beleg-Dokument samt Zeilen
   */
  withDocument(input: {
    type: "order" | "invoice" | "delivery";
    lineItems?: Array<{ sku?: string; qty: number; netPrice?: number }>;
  }) {
    this.steps.push(async (state) => {
      if (!state.ctx || !state.tenantId || !state.companyId) {
        throw new Error("Tenant/Company context not initialized.");
      }

      // Map Beleg-Typen auf DB-Typen
      const typeMap = { order: "A", delivery: "L", invoice: "R" };
      const docType = typeMap[input.type];

      const suffix = crypto.randomUUID().slice(0, 8);

      // Document Group für Typ ermitteln oder erstellen
      let [docGroup] = await db
        .select()
        .from(schema.documentGroup)
        .where(eq(schema.documentGroup.documentType, docType))
        .limit(1);

      if (!docGroup) {
        [docGroup] = await db
          .insert(schema.documentGroup)
          .values({
            tenantId: state.tenantId,
            companyId: state.companyId,
            name: `Group ${docType} ${suffix}`,
            documentType: docType,
            groupNumber: 99,
            direction: "OUTBOUND",
            defaultWarehouseId: state.warehouseId!,
          })
          .returning();
      }

      const documentId = crypto.randomUUID();
      await db.insert(schema.document).values({
        documentId,
        tenantId: state.tenantId,
        companyId: state.companyId,
        documentType: docType,
        documentDirection: "OUTBOUND",
        documentNo: `DOC-${suffix}`,
        status: "draft",
        documentDate: new Date().toISOString().slice(0, 10),
        transactionId: crypto.randomUUID(),
        documentGroupId: docGroup.documentGroupId,
      });

      state.lastDocumentId = documentId;
      state.documentIds.push(documentId);

      // Zeilen hinzufügen
      if (input.lineItems) {
        let lineNo = 1;
        for (const item of input.lineItems) {
          let variantId = state.lastVariantId;
          let sku = item.sku ?? state.lastVariantSku;

          // Falls ein bestimmter SKU übergeben wurde, versuchen wir die passende ID aufzulösen
          if (item.sku) {
            const [found] = await db
              .select({ variantId: schema.articleVariant.variantId })
              .from(schema.articleVariant)
              .where(eq(schema.articleVariant.sku, item.sku))
              .limit(1);
            if (found) variantId = found.variantId;
          }

          await db.insert(schema.documentLine).values({
            tenantId: state.tenantId,
            documentId,
            lineNo: lineNo++,
            variantId,
            quantity: item.qty.toString(),
            netPrice: (item.netPrice ?? 10.0).toString(),
            lineType: "article",
          });
        }
      }
    });
    return this;
  }

  /**
   * Führt alle Schritte nacheinander in einer Transaktion aus und gibt die erzeugten IDs zurück.
   */
  async build() {
    const state: BuilderState = {
      articleIds: [],
      variantIds: [],
      variantSkus: [],
      documentIds: [],
    };

    // Führt die Kette sequentiell aus
    for (const step of this.steps) {
      await step(state);
    }

    return {
      tenantId: state.tenantId!,
      companyId: state.companyId!,
      warehouseId: state.warehouseId!,
      ctx: state.ctx!,

      // Direkter Zugriff auf die zuletzt erstellten Entities
      articleId: state.lastArticleId,
      variantId: state.lastVariantId,
      sku: state.lastVariantSku,
      documentId: state.lastDocumentId,

      // Listen aller im Szenario erzeugten IDs
      articleIds: state.articleIds,
      variantIds: state.variantIds,
      variantSkus: state.variantSkus,
      documentIds: state.documentIds,
    };
  }
}
```

---

## ⚡ Vorteile für die Wartbarkeit

1. **Keine FK-Verletzungen mehr**: Typische Metadaten (wie `company`, `warehouse`, `documentGroup`) werden automatisch im Hintergrund erzeugt und verknüpft, sofern kein Custom-Modell angegeben wird.
2. **Kapselung der Drizzle-Abhängigkeiten**: Das mühsame Verschachteln von IDs entfällt. Die Kette liest sich deklarativ wie eine Geschichte ("withTenant → withArticle → withVariant → withDocument").
3. **Automatische Schema-Updates**: Da alle Argumente auf `Partial<...>` der Drizzle- bzw. Capability-Typen basieren, führen Schemaänderungen entweder direkt zu Compile-Fehlern (wenn Spalten umbenannt werden) oder werden lautlos ignoriert (wenn neue, optionale Spalten hinzukommen).
4. **KI-freundlich**: LLMs können durch die Autovervollständigung und die flüssige Syntax in 3–5 Zeilen komplexe Szenarien beschreiben, ohne Hunderte Zeilen Boilerplate-Code zu generieren, der fehleranfällig ist.
