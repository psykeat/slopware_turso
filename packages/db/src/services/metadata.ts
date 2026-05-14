import { db } from "../index";
import { tenantFields, tenantLayouts, systemSettings } from "../schema/app.schema";
import { eq, and } from "drizzle-orm";

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
   * Resolves effective fields by merging global (Base Tenant), organization, and tenant scope.
   */
  async getEffectiveFields(entityName: string) {
    const rawFields = await db
      .select()
      .from(tenantFields)
      .where(eq(tenantFields.entityName, entityName));

    // Priorities: tenant > organization > global
    const merged = new Map<string, typeof rawFields[0]>();

    // 1. Global fields
    rawFields
      .filter((f) => f.scope === "global")
      .forEach((f) => merged.set(f.fieldName, f));

    // 2. Organization overrides
    if (this.context.organizationId) {
      rawFields
        .filter((f) => f.scope === "org" && f.organizationId === this.context.organizationId)
        .forEach((f) => merged.set(f.fieldName, { ...merged.get(f.fieldName), ...f }));
    }

    // 3. Tenant overrides
    rawFields
      .filter((f) => f.scope === "tenant" && f.tenantId === this.context.tenantId)
      .forEach((f) => merged.set(f.fieldName, { ...merged.get(f.fieldName), ...f }));

    // Extract English label from JSONB, or fallback to fieldName
    return Array.from(merged.values()).map(f => {
      const labelData = f.label as any;
      return {
        ...f,
        labelEn: labelData?.en || f.fieldName,
        labelDe: labelData?.de || f.fieldName,
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
}
