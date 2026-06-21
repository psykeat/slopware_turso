import {
  eq,
  and,
  asc,
  desc,
  getColumns,
  count as drizzleCount,
  like,
  ne,
  isNull,
  isNotNull,
  gt,
  gte,
  lt,
  lte,
  inArray,
  or,
  not,
  sql,
} from "drizzle-orm";

import { db } from "../index";
import { activePersistence } from "../index";
import * as schema from "../schema";
import * as sqliteSchema from "../schema/sqlite.schema";
import { ensureDefaultVariantForArticleRow } from "./default-variant-backfill";

export class DataService {
  constructor() {}

  private getSchema() {
    return activePersistence.provider === "turso" ? sqliteSchema : schema;
  }

  private async decryptLlmApiKeyListIfNeeded(entityName: string, rows: any[]) {
    if (entityName === "tenantLlmConfig" && Array.isArray(rows)) {
      const { decryptEmailCredentials } = await import("./email/credential-crypto");
      for (const row of rows) {
        if (!row) continue;
        for (const field of ["apiKey", "githubToken", "vertexCredentials"] as const) {
          if (!row[field]) continue;
          try {
            row[field] = decryptEmailCredentials<string>(row[field]);
          } catch {
            // Fallback to stored value when decryption is not possible.
          }
        }
      }
    }
    return rows;
  }

  private async encryptLlmSecretFieldsIfNeeded(entityName: string, values: Record<string, any>) {
    if (entityName !== "tenantLlmConfig") return values;
    const { encryptEmailCredentials } = await import("./email/credential-crypto");
    const update = { ...values };
    for (const field of ["apiKey", "githubToken", "vertexCredentials"] as const) {
      if (update[field]) {
        update[field] = encryptEmailCredentials(update[field]);
      }
    }
    return update;
  }

  private getTable(entityName: string) {
    const table = (this.getSchema() as any)[entityName];
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
    const entityId = Object.keys(columns).find((k) => k.toLowerCase().endsWith("id"));
    return entityId || Object.keys(columns)[0];
  }

  private async getExplicitSearchColumns(entityName: string, table: any) {
    void entityName;
    void table;
    return [];
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

  private applyLongTextOverrideMetadata(
    table: any,
    data: Record<string, any>,
    _currentRow: Record<string, any> | null,
  ) {
    const columns = getColumns(table);
    const update = { ...data };
    const now = new Date();

    for (const fieldName of Object.keys(update)) {
      if (!(fieldName in columns)) continue;
      if (typeof update[fieldName] !== "string" && update[fieldName] !== null) continue;

      const sourceEntityKey = `${fieldName}SourceEntity`;
      const sourceIdKey = `${fieldName}SourceId`;
      const sourceFieldKey = `${fieldName}SourceField`;
      const linkedAtKey = `${fieldName}LinkedAt`;
      const overriddenAtKey = `${fieldName}OverriddenAt`;

      const hasMetadataColumns =
        sourceEntityKey in columns ||
        sourceIdKey in columns ||
        sourceFieldKey in columns ||
        linkedAtKey in columns ||
        overriddenAtKey in columns;
      if (!hasMetadataColumns) continue;

      const callerProvidedMetadata =
        sourceEntityKey in update ||
        sourceIdKey in update ||
        sourceFieldKey in update ||
        linkedAtKey in update ||
        overriddenAtKey in update;
      if (callerProvidedMetadata) continue;

      if (sourceEntityKey in columns) update[sourceEntityKey] = null;
      if (sourceIdKey in columns) update[sourceIdKey] = null;
      if (sourceFieldKey in columns) update[sourceFieldKey] = null;
      if (linkedAtKey in columns) update[linkedAtKey] = null;
      if (overriddenAtKey in columns) update[overriddenAtKey] = now;
    }

    return update;
  }

  private async enrichArticleVariantRows(rows: any[]) {
    if (!rows.length) return rows;

    const currentSchema = this.getSchema() as any;
    const articleOption = currentSchema.articleOption;
    const articleOptionValue = currentSchema.articleOptionValue;
    const articleVariantOptionValue = currentSchema.articleVariantOptionValue;
    const inventoryBalance = currentSchema.inventoryBalance;
    const inventoryItem = currentSchema.inventoryItem;

    const variantIds = rows
      .map((row) => row?.variantId)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    if (variantIds.length === 0) return rows;

    const [optionRows, availabilityRows] = await Promise.all([
      db
        .select({
          variantId: articleVariantOptionValue.variantId,
          optionName: articleOption.name,
          value: articleOptionValue.value,
        })
        .from(articleVariantOptionValue)
        .innerJoin(
          articleOptionValue,
          eq(articleVariantOptionValue.valueId, articleOptionValue.valueId),
        )
        .innerJoin(articleOption, eq(articleOptionValue.optionId, articleOption.optionId))
        .where(inArray(articleVariantOptionValue.variantId, variantIds))
        .orderBy(
          asc(articleVariantOptionValue.variantId),
          asc(articleOption.sortOrder),
          asc(articleOption.name),
          asc(articleOptionValue.sortOrder),
          asc(articleOptionValue.value),
        ),
      db
        .select({
          variantId: inventoryItem.variantId,
          availableQty: sql<string>`COALESCE(
            SUM(COALESCE(${inventoryBalance.availableQty}, ${inventoryBalance.onHandQty} - ${inventoryBalance.reservedQty} + ${inventoryBalance.expectedPurchaseQty})),
            0
          )`,
        })
        .from(inventoryItem)
        .leftJoin(inventoryBalance, eq(inventoryBalance.inventoryItemId, inventoryItem.itemId))
        .where(inArray(inventoryItem.variantId, variantIds))
        .groupBy(inventoryItem.variantId),
    ]);

    const optionSummaries = new Map<string, string[]>();
    for (const row of optionRows) {
      const bucket = optionSummaries.get(row.variantId) ?? [];
      const optionValue = `${row.optionName}: ${row.value}`;
      if (!bucket.includes(optionValue)) {
        bucket.push(optionValue);
      }
      optionSummaries.set(row.variantId, bucket);
    }

    const availabilityByVariant = new Map<string, string>();
    for (const row of availabilityRows) {
      availabilityByVariant.set(row.variantId, String(row.availableQty ?? "0"));
    }

    return rows.map((row) => {
      const optionSummary = optionSummaries.get(row.variantId)?.join(" / ") ?? "";
      const availableQty = availabilityByVariant.get(row.variantId) ?? "0";
      const lookupPieces = [row.sku, optionSummary, `${availableQty} available`].filter(Boolean);
      return {
        ...row,
        lookupLabel: lookupPieces.join(" · "),
        variantOptionSummary: optionSummary,
        availableQty,
      };
    });
  }

  private async enrichRows(entityName: string, rows: any[]) {
    if (entityName === "articleVariant") {
      return await this.enrichArticleVariantRows(rows);
    }
    return rows;
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

    // Non-destructive deletion filtering
    if ("archived" in table) {
      conditions.push(eq((table as any).archived, false));
    }
    if ("archivedAt" in table) {
      conditions.push(isNull((table as any).archivedAt));
    }

    // Free-text search — skip id/UUID and JSON columns. JSON-to-text casts force
    // expensive full-row scans; searchable JSON content should be projected into
    // explicit text/search columns instead.
    if (options.search?.trim()) {
      const term = `%${options.search.trim()}%`;
      const explicitSearchCols = await this.getExplicitSearchColumns(entityName, table);
      const searchableCols =
        explicitSearchCols.length > 0
          ? explicitSearchCols
          : Object.entries(getColumns(table)).filter(([name, col]) => {
              if (name === "id" || name.endsWith("Id")) return false;
              return (col as any).dataType === "string";
            });
      if (searchableCols.length > 0) {
        conditions.push(or(...searchableCols.map(([, col]) => like(col as any, term)))!);
      }
    }

    // Structured filter rules
    for (const rule of options.filterRules ?? []) {
      const col = (table as any)[rule.col];
      if (!col) continue;
      switch (rule.op) {
        case "contains":
          conditions.push(like(col, `%${rule.val}%`));
          break;
        case "not_contains":
          conditions.push(not(like(col, `%${rule.val}%`)));
          break;
        case "eq":
          conditions.push(eq(col, rule.val));
          break;
        case "neq":
          conditions.push(ne(col, rule.val));
          break;
        case "starts_with":
          conditions.push(like(col, `${rule.val}%`));
          break;
        case "ends_with":
          conditions.push(like(col, `%${rule.val}`));
          break;
        case "gt":
          conditions.push(gt(col, rule.val));
          break;
        case "gte":
          conditions.push(gte(col, rule.val));
          break;
        case "lt":
          conditions.push(lt(col, rule.val));
          break;
        case "lte":
          conditions.push(lte(col, rule.val));
          break;
        case "is_empty":
          conditions.push(isNull(col));
          break;
        case "is_not_empty":
          conditions.push(isNotNull(col));
          break;
        case "in": {
          const vals = rule.val
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
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
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : and(...conditions);

    if (entityName === "documentLine") {
      const currentSchema = this.getSchema() as any;
      const dataQ = db
        .select({
          ...getColumns(table),
          articleId: currentSchema.articleVariant.articleId,
          articleNo: currentSchema.article.articleNo,
        })
        .from(table)
        .leftJoin(
          currentSchema.articleVariant,
          eq(table.variantId, currentSchema.articleVariant.variantId),
        )
        .leftJoin(
          currentSchema.article,
          eq(currentSchema.articleVariant.articleId, currentSchema.article.articleId),
        );
      if (whereClause) dataQ.where(whereClause);
      applyOptions(dataQ);

      if (!options.count) return await dataQ;

      const countQ = db
        .select({ total: drizzleCount() })
        .from(table)
        .leftJoin(
          currentSchema.articleVariant,
          eq(table.variantId, currentSchema.articleVariant.variantId),
        )
        .leftJoin(
          currentSchema.article,
          eq(currentSchema.articleVariant.articleId, currentSchema.article.articleId),
        );
      if (whereClause) countQ.where(whereClause);

      const [data, countRows] = await Promise.all([dataQ, countQ]);
      return { data, total: Number(countRows[0]?.total ?? 0) };
    }

    const dataQ = db.select().from(table);
    if (whereClause) dataQ.where(whereClause);
    applyOptions(dataQ);

    if (!options.count) {
      const rows = await dataQ;
      const enrichedRows = await this.enrichRows(entityName, rows);
      await this.decryptLlmApiKeyListIfNeeded(entityName, enrichedRows);
      return enrichedRows;
    }

    const countQ = db.select({ total: drizzleCount() }).from(table);
    if (whereClause) countQ.where(whereClause);

    const [data, countRows] = await Promise.all([dataQ, countQ]);
    const enrichedRows = await this.enrichRows(entityName, data);
    await this.decryptLlmApiKeyListIfNeeded(entityName, enrichedRows);
    return { data: enrichedRows, total: Number(countRows[0]?.total ?? 0) };
  }

  async get(entityName: string, id: string) {
    const table = this.getTable(entityName);
    const pkName = this.getPrimaryKey(table);
    const pkColumn = (table as any)[pkName];

    const conditions = [eq(pkColumn, id)];

    const results = await db
      .select()
      .from(table)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .limit(1);
    const row = results[0] || null;
    if (row) {
      const [enrichedRow] = await this.enrichRows(entityName, [row]);
      await this.decryptLlmApiKeyListIfNeeded(entityName, [enrichedRow]);
      return enrichedRow;
    }
    return row;
  }

  async create(entityName: string, data: any) {
    const table = this.getTable(entityName);
    const lifecycleValues = this.normalizeLifecyclePayload(table, data);
    const values = lifecycleValues;

    const encryptedValues = await this.encryptLlmSecretFieldsIfNeeded(entityName, values);

    if (entityName === "article") {
      const inserted = await db.transaction(async (tx) => {
        const createdRows = await tx.insert(table).values(encryptedValues).returning();
        const [createdArticle] = createdRows;
        if (createdArticle) {
          await ensureDefaultVariantForArticleRow(tx, {
            articleId: createdArticle.articleId,
            articleNo: createdArticle.articleNo,
          });
        }
        return createdRows;
      });
      await this.decryptLlmApiKeyListIfNeeded(entityName, inserted);
      return inserted;
    }

    const inserted = await db.insert(table).values(encryptedValues).returning();
    await this.decryptLlmApiKeyListIfNeeded(entityName, inserted);
    return inserted;
  }

  async patch(entityName: string, id: string, data: any) {
    const table = this.getTable(entityName);
    const pkName = this.getPrimaryKey(table);
    const pkColumn = (table as any)[pkName];

    // Strip keys that should not be part of the update payload
    const { [pkName]: _pk, tenantId: _t, createdAt: _c, updatedAt: _u, ...updateData } = data;

    // Also strip [entityName]Id if it was passed explicitly (Drizzle doesn't like updating PKs even to same value)
    const entityPkName = `${entityName}Id`;
    if (entityPkName in updateData) delete updateData[entityPkName];

    const conditions = [eq(pkColumn, id)];

    const [currentRow] = await db
      .select()
      .from(table)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .limit(1);
    if (!currentRow) return [];

    const normalizedUpdateData = this.normalizeLifecyclePayload(table, updateData);
    const longTextAwareData = this.applyLongTextOverrideMetadata(
      table,
      normalizedUpdateData,
      currentRow,
    );

    const encryptedUpdate = await this.encryptLlmSecretFieldsIfNeeded(
      entityName,
      longTextAwareData,
    );

    const currentSchema = this.getSchema() as any;
    const articleTable = currentSchema.article;
    const articleImageTable = currentSchema.articleImage;

    let articlePrimaryBeforeArchive: string | null = null;
    if (
      entityName === "articleImage" &&
      normalizedUpdateData.archived === true &&
      currentRow.articleId &&
      currentRow.articleImageId
    ) {
      const artConditions = [eq(articleTable.articleId, currentRow.articleId)];
      const [articleRow] = await db
        .select({ primaryImageId: articleTable.primaryImageId })
        .from(articleTable)
        .where(and(...artConditions))
        .limit(1);
      articlePrimaryBeforeArchive = articleRow?.primaryImageId ?? null;
    }

    const updatedRows = await db
      .update(table)
      .set(encryptedUpdate)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .returning();

    await this.decryptLlmApiKeyListIfNeeded(entityName, updatedRows);

    if (
      entityName === "articleImage" &&
      normalizedUpdateData.archived === true &&
      currentRow.articleId &&
      currentRow.articleImageId &&
      articlePrimaryBeforeArchive === currentRow.articleImageId
    ) {
      const imgConditions = [
        eq(articleImageTable.articleId, currentRow.articleId),
        eq(articleImageTable.archived, false),
      ];
      const [replacement] = await db
        .select({ articleImageId: articleImageTable.articleImageId })
        .from(articleImageTable)
        .where(and(...imgConditions))
        .orderBy(asc(articleImageTable.sortOrder))
        .limit(1);

      const artUpdateConditions = [eq(articleTable.articleId, currentRow.articleId)];

      await db
        .update(articleTable)
        .set({ primaryImageId: replacement?.articleImageId ?? null })
        .where(and(...artUpdateConditions));
    }

    return updatedRows;
  }

  async delete(
    entityName: string,
    id: string,
  ): Promise<{ deleted: boolean; fkViolation: boolean }> {
    const table = this.getTable(entityName);
    const pkName = this.getPrimaryKey(table);
    const pkColumn = (table as any)[pkName];

    const conditions = [eq(pkColumn, id)];

    try {
      const result = await db
        .delete(table)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .returning({ id: pkColumn });
      return { deleted: result.length > 0, fkViolation: false };
    } catch (err: any) {
      if (err.code === "23503" || err.cause?.code === "23503")
        return { deleted: false, fkViolation: true };
      throw err;
    }
  }
}
