import "@tanstack/react-start/server-only";
import { db } from "../index";
import {
  accountingExportBatch,
  accountingExportRow,
  journalEntry,
  journalLine,
  fiscalPeriod,
  document,
} from "../schema/app.schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";

export class AccountingExportService {
  // 1. Create a new export batch for a fiscal period + company
  // Throws if a batch for this period+company already exists (UNIQUE constraint)
  async createExportBatch(
    tenantId: string,
    companyId: string,
    fiscalPeriodId: string,
    createdBy?: string,
  ): Promise<{ batchId: string }> {
    const [batch] = await db
      .insert(accountingExportBatch)
      .values({
        tenantId,
        companyId,
        fiscalPeriodId,
        status: "pending",
        rowCount: 0,
        createdBy: createdBy ?? null,
      })
      .returning({ batchId: accountingExportBatch.batchId });

    if (!batch) throw new Error("Failed to create export batch");
    return { batchId: batch.batchId };
  }

  // 2. Build export rows from journal data for this batch
  async buildExportRows(
    tenantId: string,
    batchId: string,
  ): Promise<{ rowCount: number }> {
    return await db.transaction(async (tx) => {
      // Fetch the batch
      const [batch] = await tx
        .select()
        .from(accountingExportBatch)
        .where(
          and(
            eq(accountingExportBatch.batchId, batchId),
            eq(accountingExportBatch.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!batch) throw new Error("Batch not found");
      if (batch.status === "exported") throw new Error("Batch already exported");

      // Fetch the fiscal period
      const [period] = await tx
        .select()
        .from(fiscalPeriod)
        .where(
          and(
            eq(fiscalPeriod.fiscalPeriodId, batch.fiscalPeriodId),
            eq(fiscalPeriod.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!period) throw new Error("Fiscal period not found");

      const companyId = batch.companyId;

      // Aggregate journal lines joined to entries and documents for the period
      const rows = await tx
        .select({
          sourceDocumentId: journalEntry.sourceDocumentId,
          sourceDocumentNo: document.documentNo,
          currencyId: document.currencyId,
          postingDate: journalEntry.postingDate,
          glAccountId: journalLine.glAccountId,
          costCenterId: journalLine.costCenterId,
          taxCodeId: journalLine.taxCodeId,
          debitAmount: sql<string>`SUM(${journalLine.debitAmount})`,
          creditAmount: sql<string>`SUM(${journalLine.creditAmount})`,
        })
        .from(journalLine)
        .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.journalEntryId))
        .leftJoin(document, eq(journalEntry.sourceDocumentId, document.documentId))
        .where(
          and(
            eq(journalLine.tenantId, tenantId),
            eq(journalEntry.companyId, companyId),
            gte(journalEntry.postingDate, period.startDate),
            lte(journalEntry.postingDate, period.endDate),
          ),
        )
        .groupBy(
          journalEntry.sourceDocumentId,
          document.documentNo,
          document.currencyId,
          journalEntry.postingDate,
          journalLine.glAccountId,
          journalLine.costCenterId,
          journalLine.taxCodeId,
        );

      if (rows.length > 0) {
        await tx.insert(accountingExportRow).values(
          rows.map((row) => ({
            batchId,
            tenantId,
            companyId,
            postingDate: row.postingDate,
            glAccountId: row.glAccountId,
            costCenterId: row.costCenterId ?? null,
            taxCodeId: row.taxCodeId ?? null,
            debitAmount: row.debitAmount ?? "0",
            creditAmount: row.creditAmount ?? "0",
            currencyId: row.currencyId ?? null,
            sourceDocumentId: row.sourceDocumentId ?? null,
            sourceDocumentNo: row.sourceDocumentNo ?? null,
          })),
        );
      }

      // Update batch row_count
      await tx
        .update(accountingExportBatch)
        .set({ rowCount: rows.length })
        .where(
          and(
            eq(accountingExportBatch.batchId, batchId),
            eq(accountingExportBatch.tenantId, tenantId),
          ),
        );

      return { rowCount: rows.length };
    });
  }

  // 3. Mark batch as exported (idempotent if already exported)
  async markBatchExported(
    tenantId: string,
    batchId: string,
  ): Promise<void> {
    const [batch] = await db
      .select()
      .from(accountingExportBatch)
      .where(
        and(
          eq(accountingExportBatch.batchId, batchId),
          eq(accountingExportBatch.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!batch) throw new Error("Batch not found");

    // Idempotent: already exported
    if (batch.status === "exported") return;

    if (batch.status === "pending" && batch.rowCount === 0) {
      throw new Error("Nothing to export: batch has no rows");
    }

    await db
      .update(accountingExportBatch)
      .set({ status: "exported", exportedAt: new Date() })
      .where(
        and(
          eq(accountingExportBatch.batchId, batchId),
          eq(accountingExportBatch.tenantId, tenantId),
        ),
      );
  }

  // 4. Rebuild: clear existing rows and re-run buildExportRows
  // Only allowed if status != 'exported'
  async rebuildBatch(
    tenantId: string,
    batchId: string,
  ): Promise<{ rowCount: number }> {
    return await db.transaction(async (tx) => {
      const [batch] = await tx
        .select()
        .from(accountingExportBatch)
        .where(
          and(
            eq(accountingExportBatch.batchId, batchId),
            eq(accountingExportBatch.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!batch) throw new Error("Batch not found");
      if (batch.status === "exported") throw new Error("Cannot rebuild an already exported batch");

      // Delete existing rows for this batch
      await tx
        .delete(accountingExportRow)
        .where(eq(accountingExportRow.batchId, batchId));

      // Fetch the fiscal period
      const [period] = await tx
        .select()
        .from(fiscalPeriod)
        .where(
          and(
            eq(fiscalPeriod.fiscalPeriodId, batch.fiscalPeriodId),
            eq(fiscalPeriod.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!period) throw new Error("Fiscal period not found");

      const companyId = batch.companyId;

      // Re-aggregate journal lines
      const rows = await tx
        .select({
          sourceDocumentId: journalEntry.sourceDocumentId,
          sourceDocumentNo: document.documentNo,
          currencyId: document.currencyId,
          postingDate: journalEntry.postingDate,
          glAccountId: journalLine.glAccountId,
          costCenterId: journalLine.costCenterId,
          taxCodeId: journalLine.taxCodeId,
          debitAmount: sql<string>`SUM(${journalLine.debitAmount})`,
          creditAmount: sql<string>`SUM(${journalLine.creditAmount})`,
        })
        .from(journalLine)
        .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.journalEntryId))
        .leftJoin(document, eq(journalEntry.sourceDocumentId, document.documentId))
        .where(
          and(
            eq(journalLine.tenantId, tenantId),
            eq(journalEntry.companyId, companyId),
            gte(journalEntry.postingDate, period.startDate),
            lte(journalEntry.postingDate, period.endDate),
          ),
        )
        .groupBy(
          journalEntry.sourceDocumentId,
          document.documentNo,
          document.currencyId,
          journalEntry.postingDate,
          journalLine.glAccountId,
          journalLine.costCenterId,
          journalLine.taxCodeId,
        );

      if (rows.length > 0) {
        await tx.insert(accountingExportRow).values(
          rows.map((row) => ({
            batchId,
            tenantId,
            companyId,
            postingDate: row.postingDate,
            glAccountId: row.glAccountId,
            costCenterId: row.costCenterId ?? null,
            taxCodeId: row.taxCodeId ?? null,
            debitAmount: row.debitAmount ?? "0",
            creditAmount: row.creditAmount ?? "0",
            currencyId: row.currencyId ?? null,
            sourceDocumentId: row.sourceDocumentId ?? null,
            sourceDocumentNo: row.sourceDocumentNo ?? null,
          })),
        );
      }

      // Update batch row_count
      await tx
        .update(accountingExportBatch)
        .set({ rowCount: rows.length })
        .where(
          and(
            eq(accountingExportBatch.batchId, batchId),
            eq(accountingExportBatch.tenantId, tenantId),
          ),
        );

      return { rowCount: rows.length };
    });
  }

  // 5. Generate CSV string from persisted rows
  async generateCsv(
    tenantId: string,
    batchId: string,
  ): Promise<string> {
    // Verify batch belongs to tenant
    const [batch] = await db
      .select()
      .from(accountingExportBatch)
      .where(
        and(
          eq(accountingExportBatch.batchId, batchId),
          eq(accountingExportBatch.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!batch) throw new Error("Batch not found");

    const rows = await db
      .select()
      .from(accountingExportRow)
      .where(
        and(
          eq(accountingExportRow.batchId, batchId),
          eq(accountingExportRow.tenantId, tenantId),
        ),
      );

    const header =
      "batch_id,posting_date,gl_account_id,cost_center_id,tax_code_id,debit_amount,credit_amount,currency_id,source_document_no";

    const dataRows = rows.map((row) => {
      const fields = [
        row.batchId,
        row.postingDate,
        row.glAccountId,
        row.costCenterId ?? "",
        row.taxCodeId ?? "",
        row.debitAmount,
        row.creditAmount,
        row.currencyId ?? "",
        row.sourceDocumentNo ?? "",
      ];
      return fields.join(",");
    });

    return [header, ...dataRows].join("\n");
  }

  // 6. Get batch details including rows
  async getBatch(
    tenantId: string,
    batchId: string,
  ): Promise<{ batch: unknown; rows: unknown[] }> {
    const [batch] = await db
      .select()
      .from(accountingExportBatch)
      .where(
        and(
          eq(accountingExportBatch.batchId, batchId),
          eq(accountingExportBatch.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!batch) throw new Error("Batch not found");

    const rows = await db
      .select()
      .from(accountingExportRow)
      .where(
        and(
          eq(accountingExportRow.batchId, batchId),
          eq(accountingExportRow.tenantId, tenantId),
        ),
      );

    return { batch, rows };
  }

  // 7. List all batches for a tenant
  async listBatches(
    tenantId: string,
    companyId?: string,
  ): Promise<unknown[]> {
    const conditions = [eq(accountingExportBatch.tenantId, tenantId)];

    if (companyId) {
      conditions.push(eq(accountingExportBatch.companyId, companyId));
    }

    return await db
      .select()
      .from(accountingExportBatch)
      .where(and(...conditions));
  }
}
