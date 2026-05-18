import { db } from "../index";
import * as schema from "../schema/app.schema";
import { eq, and, asc, desc, getColumns, count as drizzleCount, ilike, ne, isNull, isNotNull, gt, gte, lt, lte, inArray, or, not, sql } from "drizzle-orm";

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

  private normalizeLifecyclePayload(table: any, data: Record<string, any>) {
    const values = { ...data };
    const hasArchived = "archived" in table;
    const hasArchivedAt = "archivedAt" in table;

    if ("archived" in values) {
      const archived = Boolean(values.archived);
      delete values.archived;
      if (hasArchived) {
        values.archived = archived;
      }
      if (hasArchivedAt) {
        values.archivedAt = archived ? new Date() : null;
      }
    }

    return values;
  }

  async list(
    entityName: string,
    filters: Record<string, string> = {},
    options: {
      limit?: number;
      offset?: number;
      orderBy?: string;
      count?: boolean;
      search?: string;
      filterRules?: Array<{ col: string; op: string; val: string }>;
    } = {},
  ): Promise<any[] | { data: any[]; total: number }> {
    const table = this.getTable(entityName);

    const conditions = Object.entries(filters)
      .filter(([key]) => key in table)
      .map(([key, value]) => eq((table as any)[key], value));

    // Tenant isolation
    if ("tenantId" in table) {
      conditions.push(eq(table.tenantId, this.tenantId));
    }

    // Non-destructive deletion filtering
    if ("archived" in table) {
      conditions.push(eq((table as any).archived, false));
    }
    if ("archivedAt" in table) {
      conditions.push(isNull((table as any).archivedAt));
    }

    // Free-text search — skip id/UUID columns, search text-like and JSON columns.
    if (options.search?.trim()) {
      const term = `%${options.search.trim()}%`;
      const searchableCols = Object.entries(getColumns(table)).filter(([name, col]) => {
        if (name === "id" || name.endsWith("Id")) return false;
        return (col as any).dataType === "string" || (col as any).dataType === "json";
      });
      if (searchableCols.length > 0) {
        conditions.push(
          or(
            ...searchableCols.map(([, col]) => {
              const expr = (col as any).dataType === "json" ? sql`${col}::text` : (col as any);
              return ilike(expr as any, term);
            }),
          )!,
        );
      }
    }

    // Structured filter rules
    for (const rule of options.filterRules ?? []) {
      const col = (table as any)[rule.col];
      if (!col) continue;
      switch (rule.op) {
        case "contains":      conditions.push(ilike(col, `%${rule.val}%`)); break;
        case "not_contains":  conditions.push(not(ilike(col, `%${rule.val}%`))); break;
        case "eq":            conditions.push(eq(col, rule.val)); break;
        case "neq":           conditions.push(ne(col, rule.val)); break;
        case "starts_with":   conditions.push(ilike(col, `${rule.val}%`)); break;
        case "ends_with":     conditions.push(ilike(col, `%${rule.val}`)); break;
        case "gt":            conditions.push(gt(col, rule.val)); break;
        case "gte":           conditions.push(gte(col, rule.val)); break;
        case "lt":            conditions.push(lt(col, rule.val)); break;
        case "lte":           conditions.push(lte(col, rule.val)); break;
        case "is_empty":      conditions.push(isNull(col)); break;
        case "is_not_empty":  conditions.push(isNotNull(col)); break;
        case "in": {
          const vals = rule.val.split(",").map((x) => x.trim()).filter(Boolean);
          if (vals.length) conditions.push(inArray(col, vals));
          break;
        }
      }
    }

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
      if (options.offset) query.offset(options.offset);
      return query;
    };

    const whereClause =
      conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

    const dataQ = db.select().from(table);
    if (whereClause) dataQ.where(whereClause);
    applyOptions(dataQ);

    if (!options.count) return await dataQ;

    const countQ = db.select({ total: drizzleCount() }).from(table);
    if (whereClause) countQ.where(whereClause);

    const [data, countRows] = await Promise.all([dataQ, countQ]);
    return { data, total: Number(countRows[0]?.total ?? 0) };
  }

  async get(entityName: string, id: string) {
    const table = this.getTable(entityName);
    const pkName = this.getPrimaryKey(table);
    const pkColumn = (table as any)[pkName];
    const hasTenantId = "tenantId" in table;

    const conditions = [eq(pkColumn, id)];
    if (hasTenantId) {
      conditions.push(eq(table.tenantId, this.tenantId));
    }

    const results = await db
      .select()
      .from(table)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .limit(1);
    return results[0] || null;
  }

  async create(entityName: string, data: any) {
    const table = this.getTable(entityName);
    const hasTenantId = "tenantId" in table;
    const lifecycleValues = this.normalizeLifecyclePayload(table, data);
    const values = hasTenantId ? { ...lifecycleValues, tenantId: this.tenantId } : lifecycleValues;

    return await db.insert(table).values(values).returning();
  }

  async patch(entityName: string, id: string, data: any) {
    const table = this.getTable(entityName);
    const pkName = this.getPrimaryKey(table);
    const pkColumn = (table as any)[pkName];
    const hasTenantId = "tenantId" in table;

    // Strip keys that should not be part of the update payload
    const { [pkName]: _pk, tenantId: _t, createdAt: _c, updatedAt: _u, ...updateData } = data;

    // Also strip [entityName]Id if it was passed explicitly (Drizzle doesn't like updating PKs even to same value)
    const entityPkName = `${entityName}Id`;
    if (entityPkName in updateData) delete updateData[entityPkName];

    const normalizedUpdateData = this.normalizeLifecyclePayload(table, updateData);

    const conditions = [eq(pkColumn, id)];
    if (hasTenantId) {
      conditions.push(eq(table.tenantId, this.tenantId));
    }

    return await db
      .update(table)
      .set(normalizedUpdateData)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .returning();
  }

  async delete(entityName: string, id: string): Promise<{ deleted: boolean; fkViolation: boolean }> {
    const table = this.getTable(entityName);
    const pkName = this.getPrimaryKey(table);
    const pkColumn = (table as any)[pkName];
    const hasTenantId = "tenantId" in table;

    const conditions = [eq(pkColumn, id)];
    if (hasTenantId) conditions.push(eq(table.tenantId, this.tenantId));

    try {
      const result = await db
        .delete(table)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .returning({ id: pkColumn });
      return { deleted: result.length > 0, fkViolation: false };
    } catch (err: any) {
      if (err.code === "23503") return { deleted: false, fkViolation: true };
      throw err;
    }
  }
}
