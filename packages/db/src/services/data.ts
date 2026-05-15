import { db } from "../index";
import * as schema from "../schema/app.schema";
import { eq, and, asc, desc, getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

export class DataService {
  private tenantId: string;
  private isSystemAdmin: boolean;

  constructor(tenantId: string, isSystemAdmin: boolean = false) {
    this.tenantId = tenantId;
    this.isSystemAdmin = isSystemAdmin;
  }

  private getTable(entityName: string) {
    const table = (schema as any)[entityName];
    if (!table) throw new Error(`Entity ${entityName} not found in schema`);
    return table;
  }

  private getPrimaryKey(table: any) {
    const columns = getColumns(table);
    for (const [name, col] of Object.entries(columns)) {
      if ((col as any).primary) return name;
    }
    // Fallbacks
    if ("id" in columns) return "id";
    const entityId = Object.keys(columns).find(k => k.toLowerCase().endsWith("id"));
    return entityId || Object.keys(columns)[0];
  }

  async list(
    entityName: string,
    filters: Record<string, string> = {},
    options: { limit?: number; orderBy?: string } = {},
  ) {
    const table = this.getTable(entityName);

    // Build filter conditions from caller-supplied key/value pairs
    const filterConditions = Object.entries(filters)
      .filter(([key]) => key in table)
      .map(([key, value]) => eq((table as any)[key], value));

    const buildOrderBy = () => {
      if (options.orderBy) {
        const [colName, dir] = options.orderBy.split(":");
        const col = (table as any)[colName];
        if (col) return dir === "desc" ? desc(col) : asc(col);
      }
      if ("createdAt" in table) return (table as any).createdAt;
      return undefined;
    };

    const applyOptions = (query: any) => {
      const order = buildOrderBy();
      if (order) query.orderBy(order);
      if (options.limit) query.limit(options.limit);
      return query;
    };

    if (this.isSystemAdmin) {
      const query = db.select().from(table);
      if (filterConditions.length > 0) {
        query.where(filterConditions.length === 1 ? filterConditions[0] : and(...filterConditions));
      }
      applyOptions(query);
      return await query;
    }

    // Regular users are isolated by tenantId if the column exists
    const hasTenantId = "tenantId" in table;

    if (!hasTenantId) {
      const query = db.select().from(table);
      if (filterConditions.length > 0) {
        query.where(filterConditions.length === 1 ? filterConditions[0] : and(...filterConditions));
      }
      applyOptions(query);
      return await query;
    }

    const tenantCondition = eq(table.tenantId, this.tenantId);
    const allConditions =
      filterConditions.length === 0 ? tenantCondition : and(tenantCondition, ...filterConditions);

    const baseQuery = db.select().from(table).where(allConditions);
    applyOptions(baseQuery);
    return await baseQuery;
  }

  async get(entityName: string, id: string) {
    const table = this.getTable(entityName);
    const pkName = this.getPrimaryKey(table);
    const pkColumn = (table as any)[pkName];
    const hasTenantId = "tenantId" in table;

    const condition = this.isSystemAdmin || !hasTenantId
      ? eq(pkColumn, id)
      : and(eq(pkColumn, id), eq(table.tenantId, this.tenantId));

    const results = await db.select().from(table).where(condition).limit(1);
    return results[0] || null;
  }

  async create(entityName: string, data: any) {
    const table = this.getTable(entityName);
    const hasTenantId = "tenantId" in table;
    const values = hasTenantId ? { ...data, tenantId: this.tenantId } : data;
    
    return await db
      .insert(table)
      .values(values)
      .returning();
  }

  async patch(entityName: string, id: string, data: any) {
    const table = this.getTable(entityName);
    const pkName = this.getPrimaryKey(table);
    const pkColumn = (table as any)[pkName];
    const hasTenantId = "tenantId" in table;

    // Strip keys that should not be part of the update payload
    const { 
      [pkName]: _pk, 
      tenantId: _t, 
      createdAt: _c, 
      updatedAt: _u,
      ...updateData 
    } = data;

    // Also strip [entityName]Id if it was passed explicitly (Drizzle doesn't like updating PKs even to same value)
    const entityPkName = `${entityName}Id`;
    if (entityPkName in updateData) delete updateData[entityPkName];

    const condition = this.isSystemAdmin || !hasTenantId
      ? eq(pkColumn, id)
      : and(eq(pkColumn, id), eq(table.tenantId, this.tenantId));

    return await db
      .update(table)
      .set(updateData)
      .where(condition)
      .returning();
  }
}
