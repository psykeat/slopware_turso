import { sql } from "drizzle-orm";

import { db } from "../index";

const DEFAULT_MV_REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000;

let refreshInFlight: Promise<void> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshPending = false;
let lastRefreshStartedAt = 0;

function getRefreshMinIntervalMs(): number {
  const configured = Number(process.env.STATISTICS_MV_REFRESH_MIN_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 0
    ? configured
    : DEFAULT_MV_REFRESH_MIN_INTERVAL_MS;
}

export async function refreshStatisticsMVs(_tenantId?: string): Promise<void> {
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period`);
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period_customer`);
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_period_article`);
}

function schedulePendingRefresh() {
  if (refreshInFlight || refreshTimer) return;

  const elapsed = Date.now() - lastRefreshStartedAt;
  const delayMs = Math.max(0, getRefreshMinIntervalMs() - elapsed);

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    if (!refreshPending) return;

    refreshPending = false;
    lastRefreshStartedAt = Date.now();
    refreshInFlight = refreshStatisticsMVs()
      .catch((error) => {
        console.error("Failed to refresh statistics materialized views", error);
      })
      .finally(() => {
        refreshInFlight = null;
        if (refreshPending) {
          schedulePendingRefresh();
        }
      });
  }, delayMs);
  (refreshTimer as { unref?: () => void }).unref?.();
}

export function queueStatisticsMVRefresh(_tenantId?: string): void {
  refreshPending = true;
  schedulePendingRefresh();
}
