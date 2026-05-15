import { db } from "../index";
import { 
  tenantFields, 
  tenantLayouts, 
  systemSettings, 
  schemaAnnotations,
  helperTableRegistry
} from "../schema/app.schema";
import * as schema from "../schema/index";
import { eq, and, getColumns } from "drizzle-orm";

export interface MetadataContext {
  tenantId: string;
  organizationId?: string;
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

        // Auto-discover lookups by naming convention (e.g. addressCategoryId -> addressCategory)
        let lookupTable: string | undefined = undefined;
        if (colName.endsWith("Id") && colName !== "tenantId") {
            const potentialEntity = colName.slice(0, -2);
            if ((schema as any)[potentialEntity] && potentialEntity !== entityName) {
                lookupTable = potentialEntity;
            }
        }

        introspectedFields.set(colName, {
          fieldName: colName,
          entityName,
          fieldType: 
            columnType === "PgNumeric" ? "numeric" :
            columnType === "PgInteger" ? "integer" :
            columnType === "PgBoolean" ? "boolean" :
            columnType === "PgTimestamp" || columnType === "PgDate" ? "timestamp" : "text",
          isVisible: !isPk && !isUuid && !colName.endsWith("Id") && colName !== "tenantId" && colName !== "createdAt" && colName !== "archived" && colName !== "isActive",
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
    const merged = new Map<string, any>(introspectedFields);

    // Apply tenant-level overrides (Global/Org/Tenant)
    const scopes = ["global", "org", "tenant"];
    for (const scope of scopes) {
      const scopeOverrides = overrides.filter(o => {
        if (o.scope !== scope) return false;
        if (scope === "org") return o.organizationId === this.context.organizationId;
        if (scope === "tenant") return o.tenantId === this.context.tenantId;
        return true;
      });

      for (const o of scopeOverrides) {
        merged.set(o.fieldName, { ...merged.get(o.fieldName), ...o });
      }
    }

    // 5. Fetch Lookup Information from Registry
    const registries = await db
      .select()
      .from(helperTableRegistry);

    // 6. Finalize structure and i18n
    return Array.from(merged.values()).map(f => {
      let labelEn = f.fieldName;
      let labelDe = f.fieldName;
      let helpTextEn = "";
      let helpTextDe = "";

      const labelData = typeof f.label === 'string' ? JSON.parse(f.label) : f.label;
      if (labelData) {
        labelEn = labelData.en || labelData.de || f.fieldName;
        labelDe = labelData.de || labelData.en || f.fieldName;
      }

      const helpData = typeof f.helpText === 'string' ? JSON.parse(f.helpText) : f.helpText;
      if (helpData) {
        helpTextEn = helpData.en || "";
        helpTextDe = helpData.de || "";
      }

      const registry = registries.find(r => r.tableName === f.lookupTable);
      
      return {
        ...f,
        labelEn,
        labelDe,
        helpTextEn,
        helpTextDe,
        // Enforce basic invariants
        isVisible: f.isVisible !== false && f.fieldName !== "tenantId",
        // Map lookup info
        lookupTable: f.lookupTable,
        lookupFilter: f.lookupFilter,
        lookupPkColumn: registry?.pkColumn,
        lookupDisplayColumn: registry?.displayColumn,
        lookupIsI18n: registry?.displayIsI18n,
      };
    });
  }

  /**
   * Resolves effective layout definition.
   */
  async getEffectiveLayout(entityName: string, layoutKey: string) {
    const rawLayouts = await db
      .select()
      .from(tenantLayouts)
      .where(
        and(
          eq(tenantLayouts.entityName, entityName),
          eq(tenantLayouts.layoutKey, layoutKey)
        )
      );

    let effectiveLayout = rawLayouts.find((l) => l.scope === "global")?.layoutDefinition || {};

    if (this.context.organizationId) {
      const orgLayout = rawLayouts.find(
        (l) => l.scope === "org" && l.organizationId === this.context.organizationId
      );
      if (orgLayout) effectiveLayout = { ...effectiveLayout, ...(orgLayout.layoutDefinition as object) };
    }

    const tenantLayout = rawLayouts.find(
      (l) => l.scope === "tenant" && l.tenantId === this.context.tenantId
    );
    if (tenantLayout) effectiveLayout = { ...effectiveLayout, ...(tenantLayout.layoutDefinition as object) };

    return effectiveLayout;
  }

  /**
   * Resolves system settings by key.
   */
  async getEffectiveSetting(key: string) {
    const rawSettings = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));

    let effectiveValue = rawSettings.find((s) => s.scope === "global")?.value;

    if (this.context.organizationId) {
      const orgSetting = rawSettings.find(
        (s) => s.scope === "org" && s.organizationId === this.context.organizationId
      );
      if (orgSetting) effectiveValue = orgSetting.value;
    }

    const tenantSetting = rawSettings.find(
      (s) => s.scope === "tenant" && s.tenantId === this.context.tenantId
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
