import { eq, and, getColumns } from "drizzle-orm";

import { db } from "../index";
import {
  tenantFields,
  tenantLayouts,
  systemSettings,
  schemaAnnotations,
  helperTableRegistry,
} from "../schema/app.schema";
import * as schema from "../schema/index";

export interface MetadataContext {
  tenantId: string;
  organizationId?: string;
}

const technicalFieldNames = new Set([
  "tenantId",
  "createdAt",
  "updatedAt",
  "archived",
  "archivedAt",
  "isActive",
]);

function getFieldType(columnType: string | undefined) {
  return columnType === "PgNumeric"
    ? "numeric"
    : columnType === "PgInteger"
      ? "integer"
      : columnType === "PgBoolean"
        ? "boolean"
        : columnType === "PgTimestamp" || columnType === "PgDate"
          ? "timestamp"
          : "text";
}

function resolveLookupTable(entityName: string, colName: string) {
  if (entityName === "documentGroup" && colName === "nextGroupId") {
    return "documentGroup";
  }

  if (
    colName === "baseUnitId" ||
    colName === "salesUnitId" ||
    colName === "purchaseUnitId"
  ) {
    return "unit";
  }

  if (colName.endsWith("Id") && colName !== "tenantId") {
    const potentialEntity = colName.slice(0, -2);
    if ((schema as any)[potentialEntity] && potentialEntity !== entityName) {
      return potentialEntity;
    }
  }

  return undefined;
}

function mergeOverrides(
  baseFields: Map<string, any>,
  overrides: any[],
  context: MetadataContext,
) {
  const merged = new Map<string, any>(baseFields);
  const scopes = ["global", "org", "tenant"];

  for (const scope of scopes) {
    const scopeOverrides = overrides.filter((o) => {
      if (o.scope !== scope) return false;
      if (scope === "org") return o.organizationId === context.organizationId;
      if (scope === "tenant") return o.tenantId === context.tenantId;
      return true;
    });

    for (const o of scopeOverrides) {
      if (!merged.has(o.fieldName)) continue;
      merged.set(o.fieldName, { ...merged.get(o.fieldName), ...o });
    }
  }

  return merged;
}

function parseLocalizedValue(value: unknown) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function resolveLookupMetadata(f: Record<string, any>, registries: any[]) {
  const registry = registries.find((r) => r.tableName === f.lookupTable);
  const lookupSchemaTable = f.lookupTable ? (schema as any)[f.lookupTable] : undefined;
  const lookupColumns = lookupSchemaTable ? getColumns(lookupSchemaTable) : undefined;
  const tableColumns = lookupColumns ? Object.keys(lookupColumns) : [];

  const inferredPkColumn =
    registry?.pkColumn ??
    tableColumns.find((columnName) => {
      const col = (lookupColumns as any)[columnName];
      return (col as any)?.primary || false;
    }) ??
    tableColumns.find((columnName) => columnName.toLowerCase().endsWith("id")) ??
    tableColumns[0];

  const inferredCodeColumn =
    registry?.codeColumn ??
    (tableColumns.includes("code")
      ? "code"
      : tableColumns.includes("iso2Code")
        ? "iso2Code"
        : tableColumns.includes("iso3Code")
          ? "iso3Code"
          : undefined);

  const inferredDisplayColumn =
    registry?.displayColumn ??
    (tableColumns.includes("name")
      ? "name"
      : tableColumns.includes("code")
        ? "code"
        : tableColumns[0]);

  return {
    inferredPkColumn,
    inferredCodeColumn,
    inferredDisplayColumn,
    inferredValueColumn: registry?.valueColumn ?? inferredPkColumn ?? inferredCodeColumn,
    lookupSortColumn: registry?.sortColumn ?? inferredDisplayColumn,
    lookupIsI18n: registry?.displayIsI18n,
  };
}

function finalizeLocalizedField(
  f: Record<string, any>,
  registries: any[],
) {
  let labelEn = f.fieldName;
  let labelDe = f.fieldName;
  let helpTextEn = "";
  let helpTextDe = "";

  const labelData = parseLocalizedValue(f.label);
  if (labelData) {
    labelEn = labelData.en || labelData.de || f.fieldName;
    labelDe = labelData.de || labelData.en || f.fieldName;
  }

  const helpData = parseLocalizedValue(f.helpText);
  if (helpData) {
    helpTextEn = helpData.en || "";
    helpTextDe = helpData.de || "";
  }

  const lookupMetadata = resolveLookupMetadata(f, registries);

  return {
    ...f,
    labelEn,
    labelDe,
    helpTextEn,
    helpTextDe,
    // Enforce basic invariants
    isVisible: f.isVisible !== false && !technicalFieldNames.has(f.fieldName),
    // Map lookup info
    lookupTable: f.lookupTable,
    lookupFilter: f.lookupFilter,
    lookupPkColumn: lookupMetadata.inferredPkColumn,
    lookupDisplayColumn: lookupMetadata.inferredDisplayColumn,
    lookupCodeColumn: lookupMetadata.inferredCodeColumn,
    lookupValueColumn: lookupMetadata.inferredValueColumn,
    lookupSortColumn: lookupMetadata.lookupSortColumn,
    lookupIsI18n: lookupMetadata.lookupIsI18n,
  };
}

export class MetadataResolver {
  private context: MetadataContext;

  constructor(context: MetadataContext) {
    this.context = context;
  }

  /**
   * Resolves effective fields by combining schema introspection with persistent annotations and tenant overrides.
   */
  async getEffectiveFields(entityName: string) {
    // 1. Physical Schema Introspection
    const table = (schema as any)[entityName];
    const introspectedFields = new Map<string, any>();

    if (table) {
      const columns = getColumns(table);
      for (const [colName, col] of Object.entries(columns)) {
        const columnType = (col as any).columnType;
        const isPk = (col as any).primary || false;
        const isUuid = columnType === "PgUUID" || (col as any).dataType === "uuid";
        const lookupTable = resolveLookupTable(entityName, colName);

        introspectedFields.set(colName, {
          fieldName: colName,
          entityName,
          fieldType: getFieldType(columnType),
          // document_group.next_group_id is a business field even though it ends with Id
          // and needs to stay visible for conversion sequencing.
          isVisible:
            (!isPk &&
              !technicalFieldNames.has(colName) &&
              (!colName.endsWith("Id") || !!lookupTable)) ||
            (entityName === "documentGroup" && colName === "nextGroupId"),
          isRequired: (col as any).notNull || false,
          label: { en: colName, de: colName },
          scope: "introspection",
          lookupTable,
          isUuid,
          isPk,
        });
      }
    }

    // 2. Fetch Schema Annotations (The "Automatic" Business Layer)
    const annotations = await db
      .select()
      .from(schemaAnnotations)
      .where(eq(schemaAnnotations.tableName, entityName));

    for (const ann of annotations) {
      const field = introspectedFields.get(ann.columnName);
      if (field) {
        field.label = { en: ann.businessName, de: ann.businessName };
        field.helpText = { en: ann.description, de: ann.description };
        field.scope = "annotation";
      }
    }

    // 3. Fetch Metadata Overrides (Tenant-Specific Layer)
    const overrides = await db
      .select()
      .from(tenantFields)
      .where(eq(tenantFields.entityName, entityName));

    // 4. Merge: Introspection < Annotation < Global < Org < Tenant
    const merged = mergeOverrides(introspectedFields, overrides, this.context);

    // 5. Fetch Lookup Information from Registry
    const registries = await db.select().from(helperTableRegistry);

    // 6. Finalize structure and i18n
    return Array.from(merged.values()).map((f) => finalizeLocalizedField(f, registries));
  }

  /**
   * Resolves effective layout definition.
   */
  async getEffectiveLayout(entityName: string, layoutKey: string) {
    const rawLayouts = await db
      .select()
      .from(tenantLayouts)
      .where(and(eq(tenantLayouts.entityName, entityName), eq(tenantLayouts.layoutKey, layoutKey)));

    let effectiveLayout = rawLayouts.find((l) => l.scope === "global")?.layoutDefinition || {};

    if (this.context.organizationId) {
      const orgLayout = rawLayouts.find(
        (l) => l.scope === "org" && l.organizationId === this.context.organizationId,
      );
      if (orgLayout)
        effectiveLayout = { ...effectiveLayout, ...(orgLayout.layoutDefinition as object) };
    }

    const tenantLayout = rawLayouts.find(
      (l) => l.scope === "tenant" && l.tenantId === this.context.tenantId,
    );
    if (tenantLayout)
      effectiveLayout = { ...effectiveLayout, ...(tenantLayout.layoutDefinition as object) };

    return effectiveLayout;
  }

  /**
   * Resolves system settings by key.
   */
  async getEffectiveSetting(key: string) {
    const rawSettings = await db.select().from(systemSettings).where(eq(systemSettings.key, key));

    let effectiveValue = rawSettings.find((s) => s.scope === "global")?.value;

    if (this.context.organizationId) {
      const orgSetting = rawSettings.find(
        (s) => s.scope === "org" && s.organizationId === this.context.organizationId,
      );
      if (orgSetting) effectiveValue = orgSetting.value;
    }

    const tenantSetting = rawSettings.find(
      (s) => s.scope === "tenant" && s.tenantId === this.context.tenantId,
    );
    if (tenantSetting) effectiveValue = tenantSetting.value;

    return effectiveValue;
  }

  async getSettingsRegistry() {
    return await db
      .select()
      .from(helperTableRegistry)
      .where(eq(helperTableRegistry.category, "settings"));
  }
}
