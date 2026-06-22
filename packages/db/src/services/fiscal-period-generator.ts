import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { db } from "../index";
import { fiscalPeriod, company } from "../schema/sqlite.schema";

export async function generateFiscalPeriods(companyId: string, fiscalYear: number): Promise<void> {
  // Get company's fiscal year start month (1-12, default 1 = January)
  const companies = await db
    .select({ fiscalYearStartMonth: company.fiscalYearStartMonth })
    .from(company)
    .where(eq(company.companyId, companyId))
    .limit(1);

  const startMonth = companies[0]?.fiscalYearStartMonth ?? 1;

  const periods = [];
  for (let i = 0; i < 12; i++) {
    const periodNo = i + 1;
    // Calculate actual calendar month/year
    const calMonthIndex = (startMonth - 1 + i) % 12; // 0-based month
    const calMonth = calMonthIndex + 1; // 1-based
    const calYear = fiscalYear + Math.floor((startMonth - 1 + i) / 12);

    const startDate = `${calYear}-${String(calMonth).padStart(2, "0")}-01`;
    // Last day of month
    const nextMonth = calMonth === 12 ? 1 : calMonth + 1;
    const nextYear = calMonth === 12 ? calYear + 1 : calYear;
    const endDate = new Date(nextYear, nextMonth - 1, 0); // day 0 = last day of prev month
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    periods.push({
      companyId,
      fiscalYear,
      periodNo,
      startDate,
      endDate: endDateStr,
    });
  }

  // Insert with onConflictDoNothing (idempotent)
  await db.insert(fiscalPeriod).values(periods).onConflictDoNothing();
}

export async function resolveFiscalPeriodId(
  companyId: string,
  date: string, // ISO date string YYYY-MM-DD
): Promise<string | null> {
  // Try to find existing period
  const results = await db
    .select({
      fiscalPeriodId: fiscalPeriod.fiscalPeriodId,
      fiscalYear: fiscalPeriod.fiscalYear,
    })
    .from(fiscalPeriod)
    .where(
      and(
        eq(fiscalPeriod.companyId, companyId),
        sql`${fiscalPeriod.startDate} <= ${date}::date`,
        sql`${fiscalPeriod.endDate} >= ${date}::date`,
      ),
    )
    .limit(1);

  if (results[0]) return results[0].fiscalPeriodId;

  // Generate periods for the fiscal year containing this date
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();

  // Try generating for this year and the year before (handles fiscal years spanning two calendar years)
  await generateFiscalPeriods(companyId, year);
  await generateFiscalPeriods(companyId, year - 1);

  // Retry lookup
  const retry = await db
    .select({ fiscalPeriodId: fiscalPeriod.fiscalPeriodId })
    .from(fiscalPeriod)
    .where(
      and(
        eq(fiscalPeriod.companyId, companyId),
        sql`${fiscalPeriod.startDate} <= ${date}::date`,
        sql`${fiscalPeriod.endDate} >= ${date}::date`,
      ),
    )
    .limit(1);

  return retry[0]?.fiscalPeriodId ?? null;
}
