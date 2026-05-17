import "@tanstack/react-start/server-only";
import { db } from "../index";
import {
  importProfile,
  importProfileMappingVersion,
  importBatch,
  importRow,
  tenantConnectorMapping,
  tenantConnector,
  connectorDefinition,
  article,
  address,
} from "../schema/app.schema";
import { eq, and, desc, max } from "drizzle-orm";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Safely coerce an unknown CSV payload value to a string. */
function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/** Return toStr(v) or null when v is undefined/null. */
function toStrOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toStr(v);
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ImportProfileData {
  slug: string;
  label: string;
  targetEntity: string;
  targetCommandKey: string;
  requiresApproval: boolean;
}

export interface MappingRow {
  sourceField: string;
  targetTable: string;
  targetColumn: string;
  transform?: object;
  defaultValue?: unknown;
}

// ─── CSV helpers ────────────────────────────────────────────────────────────

/**
 * Minimal RFC-4180 CSV parser.
 * Returns an array of string arrays (rows × cells).
 */
function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  // Normalise line endings
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let pos = 0;

  const advance = () => {
    const row: string[] = [];
    while (pos < lines.length && lines[pos] !== "\n") {
      if (lines[pos] === '"') {
        // quoted field
        pos++; // skip opening quote
        let field = "";
        while (pos < lines.length) {
          if (lines[pos] === '"') {
            if (lines[pos + 1] === '"') {
              // escaped quote
              field += '"';
              pos += 2;
            } else {
              pos++; // skip closing quote
              break;
            }
          } else {
            field += lines[pos];
            pos++;
          }
        }
        row.push(field);
        // skip delimiter after closing quote
        if (pos < lines.length && lines[pos] === delimiter) pos++;
      } else {
        // unquoted field
        let field = "";
        while (pos < lines.length && lines[pos] !== delimiter && lines[pos] !== "\n") {
          field += lines[pos];
          pos++;
        }
        row.push(field.trim());
        if (pos < lines.length && lines[pos] === delimiter) pos++;
      }
    }
    // skip newline
    if (pos < lines.length && lines[pos] === "\n") pos++;
    return row;
  };

  while (pos < lines.length) {
    const row = advance();
    if (row.length > 0) rows.push(row);
  }

  return rows;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ImportService {
  constructor(
    private tenantId: string,
    private userId: string,
  ) {}

  // ─── Profiles ────────────────────────────────────────────────────────────

  async listProfiles() {
    return db
      .select()
      .from(importProfile)
      .where(and(eq(importProfile.tenantId, this.tenantId), eq(importProfile.archived, false)))
      .orderBy(desc(importProfile.createdAt));
  }

  async createProfile(data: ImportProfileData) {
    const [profile] = await db
      .insert(importProfile)
      .values({
        tenantId: this.tenantId,
        slug: data.slug,
        label: data.label,
        targetEntity: data.targetEntity,
        targetCommandKey: data.targetCommandKey,
        requiresApproval: data.requiresApproval,
      })
      .returning();
    return profile;
  }

  async updateProfile(profileId: string, data: Partial<ImportProfileData & { archived: boolean }>) {
    // Tenant isolation: verify ownership first
    const [existing] = await db
      .select({ profileId: importProfile.profileId })
      .from(importProfile)
      .where(and(eq(importProfile.profileId, profileId), eq(importProfile.tenantId, this.tenantId)))
      .limit(1);
    if (!existing) throw new Error("Profile not found");

    const [updated] = await db
      .update(importProfile)
      .set({
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.targetEntity !== undefined && { targetEntity: data.targetEntity }),
        ...(data.targetCommandKey !== undefined && { targetCommandKey: data.targetCommandKey }),
        ...(data.requiresApproval !== undefined && { requiresApproval: data.requiresApproval }),
        ...(data.archived !== undefined && { archived: data.archived }),
        updatedAt: new Date(),
      })
      .where(and(eq(importProfile.profileId, profileId), eq(importProfile.tenantId, this.tenantId)))
      .returning();
    return updated;
  }

  async archiveProfile(profileId: string): Promise<void> {
    const [existing] = await db
      .select({ profileId: importProfile.profileId })
      .from(importProfile)
      .where(and(eq(importProfile.profileId, profileId), eq(importProfile.tenantId, this.tenantId)))
      .limit(1);
    if (!existing) throw new Error("Profile not found");

    await db
      .update(importProfile)
      .set({ archived: true, updatedAt: new Date() })
      .where(and(eq(importProfile.profileId, profileId), eq(importProfile.tenantId, this.tenantId)));
  }

  // ─── Mappings ─────────────────────────────────────────────────────────────

  async getMappings(tenantConnectorId: string, profileId: string) {
    return db
      .select()
      .from(tenantConnectorMapping)
      .where(
        and(
          eq(tenantConnectorMapping.tenantId, this.tenantId),
          eq(tenantConnectorMapping.tenantConnectorId, tenantConnectorId),
          eq(tenantConnectorMapping.profileId, profileId),
        ),
      );
  }

  async saveMappings(tenantConnectorId: string, profileId: string, rows: MappingRow[]): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete existing mapping rows for this connector×profile pair
      await tx
        .delete(tenantConnectorMapping)
        .where(
          and(
            eq(tenantConnectorMapping.tenantId, this.tenantId),
            eq(tenantConnectorMapping.tenantConnectorId, tenantConnectorId),
            eq(tenantConnectorMapping.profileId, profileId),
          ),
        );

      // Insert new rows (if any)
      if (rows.length > 0) {
        await tx.insert(tenantConnectorMapping).values(
          rows.map((r) => ({
            tenantId: this.tenantId,
            tenantConnectorId,
            profileId,
            sourceField: r.sourceField,
            targetTable: r.targetTable,
            targetColumn: r.targetColumn,
            transform: (r.transform ?? { type: "direct" }) as Record<string, unknown>,
            defaultValue: r.defaultValue !== undefined ? (r.defaultValue as Record<string, unknown>) : null,
          })),
        );
      }
    });
  }

  // ─── Activate mapping ────────────────────────────────────────────────────

  async activateMapping(
    tenantConnectorId: string,
    profileId: string,
  ): Promise<{ versionId: string; versionNo: number }> {
    // Fetch current live mapping rows
    const currentRows = await db
      .select()
      .from(tenantConnectorMapping)
      .where(
        and(
          eq(tenantConnectorMapping.tenantId, this.tenantId),
          eq(tenantConnectorMapping.tenantConnectorId, tenantConnectorId),
          eq(tenantConnectorMapping.profileId, profileId),
        ),
      );

    // Compute next version number
    const [maxResult] = await db
      .select({ maxVersion: max(importProfileMappingVersion.versionNo) })
      .from(importProfileMappingVersion)
      .where(
        and(
          eq(importProfileMappingVersion.tenantConnectorId, tenantConnectorId),
          eq(importProfileMappingVersion.profileId, profileId),
        ),
      );
    const nextVersionNo = (maxResult?.maxVersion ?? 0) + 1;

    const mappingSnapshot = currentRows.map((r) => ({
      sourceField: r.sourceField,
      targetTable: r.targetTable,
      targetColumn: r.targetColumn,
      transform: r.transform,
      defaultValue: r.defaultValue,
    }));

    return await db.transaction(async (tx) => {
      // Deactivate existing active versions
      await tx
        .update(importProfileMappingVersion)
        .set({ isActive: false })
        .where(
          and(
            eq(importProfileMappingVersion.tenantConnectorId, tenantConnectorId),
            eq(importProfileMappingVersion.profileId, profileId),
            eq(importProfileMappingVersion.isActive, true),
          ),
        );

      // Insert new version
      const [newVersion] = await tx
        .insert(importProfileMappingVersion)
        .values({
          tenantId: this.tenantId,
          tenantConnectorId,
          profileId,
          versionNo: nextVersionNo,
          mappings: mappingSnapshot as unknown[],
          isActive: true,
          activatedAt: new Date(),
          activatedBy: this.userId,
        })
        .returning();

      return { versionId: newVersion.versionId, versionNo: newVersion.versionNo };
    });
  }

  // ─── Upload CSV ──────────────────────────────────────────────────────────

  async uploadCSV(params: {
    csvText: string;
    profileId: string;
    tenantConnectorId: string;
    delimiter?: string;
  }): Promise<{ batchId: string; rowCount: number; status: string }> {
    const { csvText, profileId, tenantConnectorId, delimiter = "," } = params;

    // 1. Find active mapping version
    const [activeVersion] = await db
      .select()
      .from(importProfileMappingVersion)
      .where(
        and(
          eq(importProfileMappingVersion.tenantId, this.tenantId),
          eq(importProfileMappingVersion.tenantConnectorId, tenantConnectorId),
          eq(importProfileMappingVersion.profileId, profileId),
          eq(importProfileMappingVersion.isActive, true),
        ),
      )
      .limit(1);

    if (!activeVersion) {
      throw new Error("No active mapping version found for this connector/profile pair");
    }

    // 2. Parse CSV
    const allRows = parseCSV(csvText, delimiter);
    if (allRows.length < 1) throw new Error("CSV is empty");

    const headers = allRows[0].map((h) => h.trim());
    const dataRows = allRows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));

    // 3. Apply mappings to each row
    const mappings = activeVersion.mappings as Array<{
      sourceField: string;
      targetTable: string;
      targetColumn: string;
      transform?: { type: string };
      defaultValue?: unknown;
    }>;

    const payloads: Record<string, unknown>[] = dataRows.map((row) => {
      const payload: Record<string, unknown> = {};
      for (const mapping of mappings) {
        const colIdx = headers.indexOf(mapping.sourceField);
        let value: unknown = colIdx >= 0 ? row[colIdx] : undefined;

        if ((value === undefined || value === "") && mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        }

        // transform.type === 'direct' (or default): copy as-is
        if (mapping.transform?.type !== "direct" && mapping.transform?.type !== undefined) {
          // Only direct transforms supported for now; pass through
        }

        payload[mapping.targetColumn] = value;
      }
      return payload;
    });

    // 4. Fetch the profile for targetEntity/targetCommandKey
    const [profile] = await db
      .select()
      .from(importProfile)
      .where(
        and(eq(importProfile.profileId, profileId), eq(importProfile.tenantId, this.tenantId)),
      )
      .limit(1);

    if (!profile) throw new Error("Import profile not found");

    // 5 & 6. Create batch and rows in a transaction
    const batchId = await db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(importBatch)
        .values({
          tenantId: this.tenantId,
          profileId,
          mappingVersionId: activeVersion.versionId,
          connectorId: tenantConnectorId,
          atomicityMode: "file",
          status: "pending",
          targetEntity: profile.targetEntity,
          targetCommandKey: profile.targetCommandKey,
        })
        .returning();

      if (payloads.length > 0) {
        await tx.insert(importRow).values(
          payloads.map((payload) => ({
            tenantId: this.tenantId,
            batchId: batch.batchId,
            targetEntity: profile.targetEntity,
            payload,
            status: "pending",
          })),
        );
      }

      return batch.batchId;
    });

    // 7. Auto-post if approval not required
    if (!profile.requiresApproval) {
      await this.postBatch(batchId);
    }

    // 8. Return result
    const [finalBatch] = await db
      .select({ status: importBatch.status })
      .from(importBatch)
      .where(eq(importBatch.batchId, batchId))
      .limit(1);

    return { batchId, rowCount: payloads.length, status: finalBatch?.status ?? "pending" };
  }

  // ─── Batches ─────────────────────────────────────────────────────────────

  async listBatches(filters?: { profileId?: string; status?: string }) {
    const conditions = [eq(importBatch.tenantId, this.tenantId)];
    if (filters?.profileId) {
      conditions.push(eq(importBatch.profileId, filters.profileId));
    }
    if (filters?.status) {
      conditions.push(eq(importBatch.status, filters.status));
    }

    return db
      .select()
      .from(importBatch)
      .where(and(...conditions))
      .orderBy(desc(importBatch.createdAt));
  }

  async getBatch(batchId: string): Promise<{ batch: unknown; rows: unknown[] }> {
    const [batch] = await db
      .select()
      .from(importBatch)
      .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)))
      .limit(1);

    if (!batch) throw new Error("Batch not found");

    const rows = await db
      .select()
      .from(importRow)
      .where(and(eq(importRow.batchId, batchId), eq(importRow.tenantId, this.tenantId)));

    return { batch, rows };
  }

  async approveBatch(batchId: string): Promise<void> {
    const [batch] = await db
      .select()
      .from(importBatch)
      .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)))
      .limit(1);

    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "pending" && batch.status !== "validating") {
      throw new Error(`Batch cannot be approved in status: ${batch.status}`);
    }

    await db
      .update(importBatch)
      .set({ status: "approved" })
      .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)));
  }

  async postBatch(batchId: string): Promise<{ posted: number; failed: number }> {
    const [batch] = await db
      .select()
      .from(importBatch)
      .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)))
      .limit(1);

    if (!batch) throw new Error("Batch not found");

    // Validate status: approved, or pending if requiresApproval is false
    if (batch.status !== "approved" && batch.status !== "pending") {
      throw new Error(`Batch cannot be posted in status: ${batch.status}`);
    }

    // If status is pending, check if profile allows direct posting
    if (batch.status === "pending" && batch.profileId) {
      const [profile] = await db
        .select({ requiresApproval: importProfile.requiresApproval })
        .from(importProfile)
        .where(
          and(
            eq(importProfile.profileId, batch.profileId),
            eq(importProfile.tenantId, this.tenantId),
          ),
        )
        .limit(1);

      if (profile?.requiresApproval !== false) {
        throw new Error("Batch requires approval before posting");
      }
    }

    // Fetch pending rows
    const rows = await db
      .select()
      .from(importRow)
      .where(and(eq(importRow.batchId, batchId), eq(importRow.status, "pending")));

    let posted = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const payload = row.payload as Record<string, unknown>;

        if (row.targetEntity === "article") {
          await db
            .insert(article)
            .values({
              tenantId: this.tenantId,
              articleNo: toStr(payload.articleNo),
              name: toStr(payload.name),
              description: toStrOrNull(payload.description),
              baseUnit: toStrOrNull(payload.baseUnit),
            })
            .onConflictDoUpdate({
              target: [article.tenantId, article.articleNo],
              set: {
                ...(payload.name !== undefined && { name: toStr(payload.name) }),
                ...(payload.description !== undefined && {
                  description: toStrOrNull(payload.description),
                }),
                ...(payload.baseUnit !== undefined && { baseUnit: toStrOrNull(payload.baseUnit) }),
                updatedAt: new Date(),
              },
            });
        } else if (row.targetEntity === "address") {
          const countryRaw = toStr(payload.countryCode || "DE").slice(0, 2);
          await db
            .insert(address)
            .values({
              tenantId: this.tenantId,
              addressNo: toStr(payload.addressNo),
              addressType: toStr(payload.addressType || "customer"),
              addressLine1: toStr(payload.addressLine1),
              postalCode: toStr(payload.postalCode),
              city: toStr(payload.city),
              countryCode: countryRaw,
              companyName: toStrOrNull(payload.companyName),
              firstName: toStrOrNull(payload.firstName),
              lastName: toStrOrNull(payload.lastName),
            })
            .onConflictDoUpdate({
              target: [address.tenantId, address.addressNo],
              set: {
                ...(payload.addressType !== undefined && {
                  addressType: toStr(payload.addressType),
                }),
                ...(payload.addressLine1 !== undefined && {
                  addressLine1: toStr(payload.addressLine1),
                }),
                ...(payload.postalCode !== undefined && {
                  postalCode: toStr(payload.postalCode),
                }),
                ...(payload.city !== undefined && { city: toStr(payload.city) }),
                ...(payload.countryCode !== undefined && {
                  countryCode: toStr(payload.countryCode).slice(0, 2),
                }),
                ...(payload.companyName !== undefined && {
                  companyName: toStrOrNull(payload.companyName),
                }),
                ...(payload.firstName !== undefined && { firstName: toStrOrNull(payload.firstName) }),
                ...(payload.lastName !== undefined && { lastName: toStrOrNull(payload.lastName) }),
                updatedAt: new Date(),
              },
            });
        }

        await db
          .update(importRow)
          .set({ status: "posted", postedAt: new Date() })
          .where(eq(importRow.rowId, row.rowId));

        posted++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(importRow)
          .set({
            status: "failed",
            errorDetail: { message } as Record<string, unknown>,
          })
          .where(eq(importRow.rowId, row.rowId));
        failed++;
      }
    }

    const finalStatus = failed > 0 ? "failed" : "posted";
    await db
      .update(importBatch)
      .set({
        status: finalStatus,
        postedEntityCount: posted,
        processedAt: new Date(),
      })
      .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)));

    return { posted, failed };
  }

  // ─── Connectors ───────────────────────────────────────────────────────────

  async listConnectors() {
    return db
      .select({
        tenantConnectorId: tenantConnector.tenantConnectorId,
        connectorId: tenantConnector.connectorId,
        label: connectorDefinition.label,
        slug: connectorDefinition.slug,
      })
      .from(tenantConnector)
      .innerJoin(
        connectorDefinition,
        eq(connectorDefinition.connectorId, tenantConnector.connectorId),
      )
      .where(
        and(
          eq(tenantConnector.tenantId, this.tenantId),
          eq(tenantConnector.isActive, true),
          eq(tenantConnector.archived, false),
        ),
      );
  }
}
