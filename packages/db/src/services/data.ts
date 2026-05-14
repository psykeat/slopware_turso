import { db } from "../index";
import * as schema from "../schema/app.schema";
import { eq, and } from "drizzle-orm";

export class DataService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  private getTable(entityName: string) {
    const table = (schema as any)[entityName];
    if (!table) throw new Error(`Entity ${entityName} not found in schema`);
    return table;
  }

  async list(entityName: string, filters: any = {}) {
    const table = this.getTable(entityName);
    
    // Always filter by tenantId for isolation
    return await db
      .select()
      .from(table)
      .where(eq(table.tenantId, this.tenantId));
  }

  async create(entityName: string, data: any) {
    const table = this.getTable(entityName);
    return await db
      .insert(table)
      .values({ ...data, tenantId: this.tenantId })
      .returning();
  }

  async patch(entityName: string, id: string, data: any) {
    const table = this.getTable(entityName);
    const pkColumn = table[Object.keys(table).find((k) => k.endsWith("Id")) || "id"];

    return await db
      .update(table)
      .set(data)
      .where(and(eq(pkColumn, id), eq(table.tenantId, this.tenantId)))
      .returning();
  }
}
