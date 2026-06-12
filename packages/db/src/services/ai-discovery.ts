import { and, eq, getColumns, isNull, or } from "drizzle-orm";

import { db } from "../index";
import {
  entityCommands,
  helperTableRegistry,
  schemaAnnotations,
  tenantFields,
} from "../schema/app.schema";
import * as schema from "../schema/index";

export interface SemanticEntity {
  entityName: string;
  businessName: string;
  module: string;
  description: string;
}

export interface SemanticField {
  fieldName: string;
  businessName: string;
  description: string;
  dataType:
    | "text"
    | "numeric"
    | "integer"
    | "boolean"
    | "timestamp"
    | "lookup"
    | "email"
    | "unknown";
  isRequired: boolean;
  isWritable: boolean;
  lookupTable?: string;
  lookupDisplayColumn?: string;
  lookupCodeColumn?: string;
  lookupValueColumn?: string;
  defaultValue?: string;
}

export interface SemanticRelationship {
  fromEntity: string;
  fromField: string;
  toEntity: string;
  relationType: "ONE_TO_MANY" | "MANY_TO_ONE" | "ONE_TO_ONE";
  businessDescription: string;
}

export interface SemanticCommand {
  commandKey: string;
  label: string;
  description: string;
  entityName: string;
  inputSchema: Record<string, any>;
  writesTables: string[];
  /** Set when the command is executable through the capability registry. */
  capabilityKey?: string | null;
}

// Built-in business-focused defaulting relationship mappings (Semantic Relationship Catalog)
const SEMANTIC_RELATIONSHIPS: SemanticRelationship[] = [
  {
    fromEntity: "document",
    fromField: "customerId",
    toEntity: "address",
    relationType: "MANY_TO_ONE",
    businessDescription: "Ordnet den Beleg einem Kunden (Geschäftspartner) zu.",
  },
  {
    fromEntity: "document",
    fromField: "deliveryAddressId",
    toEntity: "deliveryAddress",
    relationType: "MANY_TO_ONE",
    businessDescription: "Lieferadresse für den physischen Warenversand des Belegs.",
  },
  {
    fromEntity: "documentLine",
    fromField: "documentId",
    toEntity: "document",
    relationType: "MANY_TO_ONE",
    businessDescription: "Verknüpft die Belegzeile mit dem übergeordneten Beleg-Kopf.",
  },
  {
    fromEntity: "documentLine",
    fromField: "articleId",
    toEntity: "article",
    relationType: "MANY_TO_ONE",
    businessDescription: "Verknüpft die Belegzeile mit dem verkauften oder bestellten Artikel.",
  },
  {
    fromEntity: "addressContact",
    fromField: "addressId",
    toEntity: "address",
    relationType: "MANY_TO_ONE",
    businessDescription:
      "Verknüpft einen Ansprechpartner mit der Hauptadresse des Geschäftspartners.",
  },
  {
    fromEntity: "article",
    fromField: "articleGroupId",
    toEntity: "articleGroup",
    relationType: "MANY_TO_ONE",
    businessDescription: "Klassifiziert den Artikel in eine hierarchische Warengruppe.",
  },
  {
    fromEntity: "inventoryItem",
    fromField: "variantId",
    toEntity: "articleVariant",
    relationType: "MANY_TO_ONE",
    businessDescription: "Verknüpft den Lagerartikel mit der kaufbaren Variante.",
  },
  {
    fromEntity: "inventoryLevel",
    fromField: "itemId",
    toEntity: "inventoryItem",
    relationType: "MANY_TO_ONE",
    businessDescription: "Verknüpft die Lagerposition mit dem operativen Lagerartikel.",
  },
];

function inferLookupTableName(entityName: string, colName: string, schemaRef: typeof schema) {
  if (colName === "variantId") return "articleVariant";
  if (colName === "optionId") return "articleOption";
  if (colName === "valueId") return "articleOptionValue";
  if (entityName === "inventoryLevel" && colName === "itemId") return "inventoryItem";
  if (entityName === "inventoryLevel" && colName === "locationId") return "warehouse";

  if (colName.endsWith("Id")) {
    const potentialEntity = colName.slice(0, -2);
    if ((schemaRef as any)[potentialEntity] && potentialEntity !== entityName) {
      return potentialEntity;
    }
  }

  return undefined;
}

// Fallback seed commands when the database entity_commands table is empty
const BOOTSTRAPPED_COMMANDS: Array<Omit<SemanticCommand, "entityName"> & { entityName: string }> = [
  {
    entityName: "articleVariant",
    commandKey: "generateVariants",
    label: "Varianten erzeugen",
    description:
      "Erzeugt fehlende articleVariant- und inventoryItem-Datensätze aus den definierten Artikeloptionen.",
    writesTables: ["article", "article_variant", "article_variant_option_value", "inventory_item"],
    inputSchema: {
      type: "object",
      required: ["articleId"],
      properties: {
        articleId: {
          type: "string",
          format: "uuid",
          description: "Artikelstamm, aus dem die operative Varianten- und Lagerstruktur erzeugt wird.",
        },
      },
    },
  },
  {
    entityName: "articleVariant",
    commandKey: "archiveVariants",
    label: "Varianten archivieren",
    description:
      "Archiviert die aktiven Varianten eines Artikels, ohne historische Referenzen hart zu löschen.",
    writesTables: ["article", "article_variant", "inventory_item"],
    inputSchema: {
      type: "object",
      required: ["articleId"],
      properties: {
        articleId: {
          type: "string",
          format: "uuid",
          description: "Artikelstamm, dessen Varianten archiviert werden sollen.",
        },
        variantIds: {
          type: "array",
          items: {
            type: "string",
            format: "uuid",
            description: "articleVariant-IDs, die archiviert werden sollen.",
          },
        },
      },
    },
  },
  {
    entityName: "document",
    commandKey: "create-document-draft-from-ai-plan",
    label: "Belegentwurf aus KI-Plan erstellen",
    description:
      "Erzeugt einen neuen transaktionalen Belegentwurf (z.B. Angebot oder Auftrag) basierend auf den Mappings.",
    writesTables: ["document", "document_line"],
    inputSchema: {
      type: "object",
      required: ["customerId", "docType", "lines"],
      properties: {
        customerId: {
          type: "string",
          format: "uuid",
          description: "Geschäftspartner, dem der Belegentwurf zugeordnet wird.",
        },
        docType: { type: "string", enum: ["Offer", "Order", "DeliveryNote", "Invoice"] },
        lines: {
          type: "array",
          items: {
            type: "object",
            required: ["articleId", "quantity"],
            properties: {
              articleId: {
                type: "string",
                format: "uuid",
                description:
                  "Artikelstamm, aus dem die operative Variante im Belegpfad aufgeloest wird.",
              },
              quantity: {
                type: "number",
                description: "Menge der Belegposition.",
              },
              priceOverride: {
                type: "number",
                description: "Optionaler Netto-Preis fuer die Position.",
              },
            },
          },
        },
      },
    },
  },
  {
    entityName: "address",
    commandKey: "create-address-from-ai-plan",
    label: "Adresse aus KI-Plan anlegen",
    description: "Legt einen neuen Kunden- oder Lieferantenkontakt an.",
    writesTables: ["address"],
    inputSchema: {
      type: "object",
      required: ["name", "isCustomer"],
      properties: {
        name: { type: "string", description: "Anzeige- und Suchname des Kontakts." },
        isCustomer: { type: "boolean", description: "Kennzeichnet den Kontakt als Kunde." },
        isSupplier: { type: "boolean", description: "Kennzeichnet den Kontakt als Lieferant." },
        email: { type: "string", format: "email", description: "Primäre E-Mail-Adresse." },
        phone: { type: "string", description: "Telefonnummer des Kontakts." },
        street: { type: "string", description: "Strasse und Hausnummer." },
        city: { type: "string", description: "Ort." },
        postalCode: { type: "string", description: "Postleitzahl." },
        countryCode: { type: "string", maxLength: 2, description: "ISO-3166-1 Alpha-2." },
      },
    },
  },
  {
    entityName: "emailThread",
    commandKey: "apply-ai-mail-classification",
    label: "E-Mail-Klassifizierung anwenden",
    description: "Verknüpft die E-Mail mit einem Geschäftspartner und optional einem Beleg.",
    writesTables: ["email_thread"],
    inputSchema: {
      type: "object",
      required: ["emailThreadId"],
      properties: {
        emailThreadId: {
          type: "string",
          format: "uuid",
          description: "Zu klassifizierender E-Mail-Thread.",
        },
        relatedAddressId: {
          type: "string",
          format: "uuid",
          description: "Optional verknuepfte Adresse.",
        },
        relatedDocumentId: {
          type: "string",
          format: "uuid",
          description: "Optional verknuepfter Beleg.",
        },
      },
    },
  },
  {
    entityName: "document",
    commandKey: "convert-document-from-ai-plan",
    label: "Beleg wandeln aus KI-Plan",
    description:
      "Wandelt einen bestehenden Beleg (z.B. ein Angebot in einen Auftrag) basierend auf den Mappings um.",
    writesTables: ["document", "document_line"],
    inputSchema: {
      type: "object",
      required: ["sourceDocumentId"],
      properties: {
        sourceDocumentId: {
          type: "string",
          format: "uuid",
          description: "Quellbeleg, der in einen anderen Belegtyp ueberfuehrt werden soll.",
        },
        targetDocType: { type: "string", enum: ["Order", "DeliveryNote", "Invoice"] },
        targetGroupId: {
          type: "string",
          format: "uuid",
          description: "Optionale Zielgruppe fuer die Wandlung.",
        },
      },
    },
  },
  {
    entityName: "emailThread",
    commandKey: "prepare-document-email",
    label: "Dokumenten-E-Mail vorbereiten",
    description:
      "Erzeugt einen editierbaren E-Mail-Entwurf auf Basis eines Belegs, inklusive Standard-Anhängen und Empfängerauflösung.",
    writesTables: ["email_thread", "email_message", "email_outbox"],
    inputSchema: {
      type: "object",
      required: ["documentId", "emailIdentityId"],
      properties: {
        documentId: {
          type: "string",
          format: "uuid",
          description: "Beleg, aus dem die E-Mail vorbereitet wird.",
        },
        emailIdentityId: {
          type: "string",
          format: "uuid",
          description: "Absender-Identitaet fuer den Entwurf.",
        },
        subject: { type: "string", description: "Optionaler Betreff." },
        bodyText: { type: "string", description: "Optionaler Klartext-Inhalt." },
        bodyHtml: { type: "string", description: "Optionaler HTML-Inhalt." },
      },
    },
  },
];

export class AIDiscoveryService {
  /**
   * Resolves the list of entities that the LLM is allowed to inspect based on taskScope.
   */
  static async getSemanticEntityCatalog(
    tenantId: string,
    taskScope: string[],
  ): Promise<SemanticEntity[]> {
    // Basic static catalog mappings scoped to relevant tasks
    const allEntities: (SemanticEntity & { scopes: string[] })[] = [
      {
        entityName: "document",
        businessName: "Beleg",
        module: "Documents",
        description:
          "Belege wie Angebote (Offer), Aufträge (Order), Lieferscheine (DeliveryNote) oder Rechnungen (Invoice).",
        scopes: [
          "erp_documents",
          "sales",
          "purchase",
          "mail-classification",
          "mail-to-document-draft",
        ],
      },
      {
        entityName: "documentLine",
        businessName: "Belegzeile",
        module: "Documents",
        description: "Positionen eines Belegs, verknüpft mit Artikeln und Mengen.",
        scopes: [
          "erp_documents",
          "sales",
          "purchase",
          "mail-classification",
          "mail-to-document-draft",
        ],
      },
      {
        entityName: "address",
        businessName: "Geschäftspartner / Adresse",
        module: "Addresses",
        description: "Kunden, Lieferanten und Kontakte.",
        scopes: [
          "erp_documents",
          "sales",
          "purchase",
          "mail",
          "crm",
          "mail-classification",
          "mail-to-document-draft",
        ],
      },
      {
        entityName: "article",
        businessName: "Artikel / Produkt",
        module: "Articles",
        description: "Stammdaten von verkaufbaren oder lagernden Artikeln.",
        scopes: [
          "erp_documents",
          "sales",
          "purchase",
          "logistics",
          "mail-classification",
          "mail-to-document-draft",
        ],
      },
      {
        entityName: "articleVariant",
        businessName: "Artikelvariante",
        module: "Articles",
        description:
          "Operative SKU-Einheit eines Artikels mit Optionskombination, Lageranbindung und eigener Verfügbarkeit.",
        scopes: ["erp_documents", "sales", "purchase", "logistics"],
      },
      {
        entityName: "articleOption",
        businessName: "Artikeloption",
        module: "Articles",
        description: "Variantenachse wie Farbe, Größe oder Material für einen Artikel.",
        scopes: ["erp_documents", "sales", "purchase", "logistics"],
      },
      {
        entityName: "inventoryItem",
        businessName: "Lagerartikel",
        module: "Articles",
        description:
          "Lagerführende Einheit einer Variante als operativer Anker für Bestände und Bewegungen.",
        scopes: ["erp_documents", "sales", "purchase", "logistics"],
      },
      {
        entityName: "inventoryLevel",
        businessName: "Lagerbestand",
        module: "Logistics",
        description:
          "Bestandsmenge pro Lagerort für einen operativen Lagerartikel.",
        scopes: ["erp_documents", "sales", "purchase", "logistics"],
      },
      {
        entityName: "articleGroup",
        businessName: "Warengruppe",
        module: "Articles",
        description: "Kategorisierung von Artikeln.",
        scopes: ["erp_documents", "sales", "logistics"],
      },
      {
        entityName: "emailThread",
        businessName: "E-Mail-Thread",
        module: "Email",
        description:
          "Ein E-Mail-Thread (Gesprächsverlauf) bestehend aus einer oder mehreren E-Mail-Nachrichten.",
        scopes: ["mail-classification", "mail-to-document-draft", "mail"],
      },
      {
        entityName: "emailMessage",
        businessName: "E-Mail-Nachricht",
        module: "Email",
        description: "Eine einzelne E-Mail-Nachricht innerhalb eines Threads.",
        scopes: ["mail-classification", "mail-to-document-draft", "mail"],
      },
    ];

    // Read any custom annotations for tables from the DB
    const dbAnnotations = await db
      .select()
      .from(schemaAnnotations)
      .where(eq(schemaAnnotations.columnName, ""));

    const annotatedEntitiesMap = new Map<string, (typeof dbAnnotations)[0]>();
    for (const ann of dbAnnotations) {
      annotatedEntitiesMap.set(ann.tableName, ann);
    }

    // Filter by taskScope intersection
    const filtered = allEntities.filter((e) =>
      e.scopes.some((s) => taskScope.includes(s) || taskScope.includes("all")),
    );

    return filtered.map((e) => {
      const ann = annotatedEntitiesMap.get(e.entityName);
      return {
        entityName: e.entityName,
        businessName: ann?.businessName || e.businessName,
        module: e.module,
        description: ann?.description || e.description,
      };
    });
  }

  /**
   * Compiles the semantic field catalog for a specific entity.
   */
  static async getSemanticFieldCatalog(
    entityName: string,
    tenantId: string,
  ): Promise<SemanticField[]> {
    const tableSchema = (schema as any)[entityName];
    if (!tableSchema) return [];

    const columns = getColumns(tableSchema);
    const systemFields = new Set([
      "tenantId",
      "createdAt",
      "updatedAt",
      "archived",
      "archivedAt",
      "isActive",
      "organizationId",
    ]);

    // Query DB Schema Annotations & Tenant Fields
    const [dbAnnotations, dbTenantFields, registries] = await Promise.all([
      db.select().from(schemaAnnotations).where(eq(schemaAnnotations.tableName, entityName)),
      db
        .select()
        .from(tenantFields)
        .where(and(eq(tenantFields.entityName, entityName), eq(tenantFields.tenantId, tenantId))),
      db.select().from(helperTableRegistry),
    ]);

    const annotationsMap = new Map<string, (typeof dbAnnotations)[0]>();
    for (const ann of dbAnnotations) {
      annotationsMap.set(ann.columnName, ann);
    }

    const tenantFieldsMap = new Map<string, (typeof dbTenantFields)[0]>();
    for (const tf of dbTenantFields) {
      tenantFieldsMap.set(tf.fieldName, tf);
    }

    const semanticFields: SemanticField[] = [];

    for (const [colKey, colAny] of Object.entries(columns)) {
      const col = colAny as any;
      const colName = col.name;
      const isSystem = systemFields.has(colKey) || systemFields.has(colName);

      const ann = annotationsMap.get(colKey) || annotationsMap.get(colName);
      const tf = tenantFieldsMap.get(colKey) || tenantFieldsMap.get(colName);

      // Visibility and requiredness logic
      const isVisible = tf ? tf.isVisible : true;
      if (!isVisible && isSystem) continue;

      const isRequired = tf ? tf.isRequired : !(col as any).notNull;
      const isWritable = !isSystem && colKey !== "tenantId";

      // Detect data type
      let dataType: SemanticField["dataType"] = "text";
      const colType = (col as any).columnType;

      if (colType === "PgNumeric") dataType = "numeric";
      else if (colType === "PgInteger") dataType = "integer";
      else if (colType === "PgBoolean") dataType = "boolean";
      else if (colType === "PgTimestamp" || colType === "PgDate") dataType = "timestamp";

      const lookupTable = tf?.lookupTable || inferLookupTableName(entityName, colKey, schema);
      const lookupRegistry = lookupTable
        ? registries.find((r) => r.tableName === lookupTable)
        : undefined;
      if (lookupTable && (schema as any)[lookupTable]) {
        dataType = "lookup";
      }

      const lookupDisplayColumn =
        lookupRegistry?.displayColumn ??
        (lookupTable === "articleVariant"
          ? "lookupLabel"
          : lookupTable === "inventoryItem"
            ? "sku"
            : undefined);
      const lookupCodeColumn =
        lookupRegistry?.codeColumn ??
        (lookupTable === "articleVariant" || lookupTable === "inventoryItem" ? "sku" : undefined);
      const lookupValueColumn =
        lookupRegistry?.valueColumn ??
        (lookupTable === "articleVariant"
          ? "variantId"
          : lookupTable === "inventoryItem"
            ? "itemId"
            : undefined);

      const businessName = tf?.label
        ? (tf.label as any).de || (tf.label as any).en
        : ann?.businessName || colKey;

      const description = tf?.helpText
        ? (tf.helpText as any).de || (tf.helpText as any).en
        : ann?.description || `Technical column ${colKey}`;

      const lookupDescription =
        lookupTable === "articleVariant"
          ? `${description} Variant lookups should surface SKU and option summaries instead of UUIDs.`
          : lookupTable === "inventoryItem"
            ? `${description} Inventory item lookups should surface SKU and stock availability instead of UUIDs.`
            : description;

      semanticFields.push({
        fieldName: colKey,
        businessName,
        description: lookupDescription,
        dataType,
        isRequired: !!isRequired,
        isWritable,
        lookupTable,
        lookupDisplayColumn,
        lookupCodeColumn,
        lookupValueColumn,
        defaultValue: (col as any).default !== undefined ? String((col as any).default) : undefined,
      });
    }

    return semanticFields;
  }

  /**
   * Returns the semantic relationship catalog mapping business defaults.
   */
  static getSemanticRelationshipCatalog(): SemanticRelationship[] {
    return SEMANTIC_RELATIONSHIPS;
  }

  /**
   * Compiles the permitted commands matching the requested taskScope.
   */
  static async getSemanticCommandCatalog(
    tenantId: string,
    _taskScope: string[],
  ): Promise<SemanticCommand[]> {
    // 1. Read registered commands from the DB: tenant-scoped rows plus the
    // global capability-registry projection (tenant rows win on key clashes).
    const dbCommands = await db
      .select()
      .from(entityCommands)
      .where(
        and(
          eq(entityCommands.commandState, "published"),
          or(eq(entityCommands.tenantId, tenantId), isNull(entityCommands.tenantId)),
        ),
      );

    const seenCommands = new Set<string>();
    const commands: SemanticCommand[] = [];
    for (const c of [...dbCommands].sort((a, b) =>
      a.tenantId === b.tenantId ? 0 : a.tenantId ? -1 : 1,
    )) {
      if (c.visibility === "hidden") continue;
      const dedupeKey = `${c.entityName}::${c.commandKey}`;
      if (seenCommands.has(dedupeKey)) continue;
      seenCommands.add(dedupeKey);
      commands.push({
        commandKey: c.commandKey,
        label: (c.label as any).de || (c.label as any).en || c.commandKey,
        description: c.description ? (c.description as any).de || (c.description as any).en : "",
        entityName: c.entityName,
        inputSchema: c.inputSchema as Record<string, any>,
        writesTables: c.writesTables as string[],
        // Set for commands backed by the capability registry: executable via
        // POST /api/capabilities/{capabilityKey}/execute.
        capabilityKey: c.handlerkey ?? null,
      });
    }

    // 2. Supplement with bootstrapped commands matching the scopes
    for (const bCmd of BOOTSTRAPPED_COMMANDS) {
      if (!commands.some((c) => c.commandKey === bCmd.commandKey)) {
        commands.push({
          ...bCmd,
        });
      }
    }

    return commands;
  }

  /**
   * Compiles key-value mappings of lookup helpers (e.g. currencies, unit definitions).
   */
  static async getSemanticContext(_tenantId: string): Promise<Record<string, any>> {
    // Read from helper registries to extract simple key/value definitions
    const registries = await db.select().from(helperTableRegistry);
    const context: Record<string, any> = {};

    for (const reg of registries) {
      // Limit to global settings or small lists like currency/unit
      if (reg.tableName === "currency" || reg.tableName === "unit" || reg.tableName === "taxCode") {
        const tableSchema = (schema as any)[reg.tableName];
        if (tableSchema) {
          const rows = await db.select().from(tableSchema);
          context[reg.tableName] = rows.map((r: any) => ({
            id: r[reg.pkColumn],
            display: r[reg.displayColumn],
            code: reg.codeColumn ? r[reg.codeColumn] : undefined,
          }));
        }
      }
    }

    return context;
  }
}
