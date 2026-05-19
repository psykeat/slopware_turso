import { sql } from "drizzle-orm";

import { db } from "../index";

export async function refreshStatisticsMVs(_tenantId?: string): Promise<void> {
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period`);
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period_customer`);
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period_article`);
}
