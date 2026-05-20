import { eq, and } from "drizzle-orm";

import { db } from "../index";
import { tenantFields, tenantGroups, tenantLayouts, metadataHistory } from "../schema/app.schema";

export interface MetadataWriterContext {
  tenantId: string;
  userId: string;
  isSystemAdmin: boolean;
  isBaseTenant: boolean;
  organizationId?: string;
}

export class MetadataWriter {
  private context: MetadataWriterContext;

  constructor(context: MetadataWriterContext) {
    this.context = context;
  }

  private getScope() {
    return this.context.isSystemAdmin && this.context.isBaseTenant ? "global" : "tenant";
  }

  private async logHistory(
    tx: any,
    params: {
      entityName: string;
      metadataType: "field" | "group" | "layout";
      metadataKey: string;
      oldValue: any;
      newValue: any;
      changeType: "insert" | "update" | "delete";
    },
  ) {
    await tx.insert(metadataHistory).values({
      tenantId: this.context.tenantId,
      userId: this.context.userId,
      entityName: params.entityName,
      metadataType: params.metadataType,
      metadataKey: params.metadataKey,
      oldValue: params.oldValue,
      newValue: params.newValue,
      changeType: params.changeType,
    });
  }

  async saveFieldOverride(entityName: string, fieldName: string, data: any) {
    const scope = this.getScope();
    return await db.transaction(async (tx) => {
      const where = [
        eq(tenantFields.entityName, entityName),
        eq(tenantFields.fieldName, fieldName),
        eq(tenantFields.scope, scope),
      ];

      if (scope === "tenant") {
        where.push(eq(tenantFields.tenantId, this.context.tenantId));
      }

      const existing = await tx
        .select()
        .from(tenantFields)
        .where(and(...where))
        .limit(1);

      if (existing.length > 0) {
        const old = existing[0];
        await tx
          .update(tenantFields)
          .set({
            ...data,
          })
          .where(and(...where));

        await this.logHistory(tx, {
          entityName,
          metadataType: "field",
          metadataKey: fieldName,
          oldValue: old,
          newValue: data,
          changeType: "update",
        });
      } else {
        await tx.insert(tenantFields).values({
          ...data,
          entityName,
          fieldName,
          scope,
          tenantId: scope === "tenant" ? this.context.tenantId : null,
        });

        await this.logHistory(tx, {
          entityName,
          metadataType: "field",
          metadataKey: fieldName,
          oldValue: null,
          newValue: data,
          changeType: "insert",
        });
      }
    });
  }

  async saveGroupOverride(entityName: string, groupKey: string, data: any) {
    const scope = this.getScope();
    return await db.transaction(async (tx) => {
      const where = [
        eq(tenantGroups.entityName, entityName),
        eq(tenantGroups.groupKey, groupKey),
        eq(tenantGroups.scope, scope),
      ];

      if (scope === "tenant") {
        where.push(eq(tenantGroups.tenantId, this.context.tenantId));
      }

      const existing = await tx
        .select()
        .from(tenantGroups)
        .where(and(...where))
        .limit(1);

      if (existing.length > 0) {
        const old = existing[0];
        await tx
          .update(tenantGroups)
          .set({
            ...data,
          })
          .where(and(...where));

        await this.logHistory(tx, {
          entityName,
          metadataType: "group",
          metadataKey: groupKey,
          oldValue: old,
          newValue: data,
          changeType: "update",
        });
      } else {
        await tx.insert(tenantGroups).values({
          ...data,
          entityName,
          groupKey,
          scope,
          tenantId: scope === "tenant" ? this.context.tenantId : null,
        });

        await this.logHistory(tx, {
          entityName,
          metadataType: "group",
          metadataKey: groupKey,
          oldValue: null,
          newValue: data,
          changeType: "insert",
        });
      }
    });
  }

  async saveLayoutOverride(entityName: string, layoutKey: string, data: any) {
    const scope = this.getScope();
    return await db.transaction(async (tx) => {
      const where = [
        eq(tenantLayouts.entityName, entityName),
        eq(tenantLayouts.layoutKey, layoutKey),
        eq(tenantLayouts.scope, scope),
      ];

      if (scope === "tenant") {
        where.push(eq(tenantLayouts.tenantId, this.context.tenantId));
      }

      const existing = await tx
        .select()
        .from(tenantLayouts)
        .where(and(...where))
        .limit(1);

      if (existing.length > 0) {
        const old = existing[0];
        await tx
          .update(tenantLayouts)
          .set({
            layoutDefinition: data,
          })
          .where(and(...where));

        await this.logHistory(tx, {
          entityName,
          metadataType: "layout",
          metadataKey: layoutKey,
          oldValue: old,
          newValue: data,
          changeType: "update",
        });
      } else {
        await tx.insert(tenantLayouts).values({
          entityName,
          layoutKey,
          layoutDefinition: data,
          scope,
          tenantId: scope === "tenant" ? this.context.tenantId : null,
        });

        await this.logHistory(tx, {
          entityName,
          metadataType: "layout",
          metadataKey: layoutKey,
          oldValue: null,
          newValue: data,
          changeType: "insert",
        });
      }
    });
  }
}
