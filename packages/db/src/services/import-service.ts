import "@tanstack/react-start/server-only";
import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import * as readline from "node:readline";

import { and, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../index";
import { backfillDefaultArticleVariants } from "./default-variant-backfill";
import { MetadataResolver } from "./metadata";
import {
  address,
  article,
  articleGroup,
  articleVariant,
  buerowareRecordField,
  buerowareRecordLayout,
  connectorDefinition,
  externalSyncMapping,
  importBatch,
  importFieldMapping,
  importProfile,
  importProfileMappingVersion,
  importRow,
  tenantConnector,
  tenantConnectorMapping,
  unit,
} from "../schema/app.schema";

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

function toBoolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  const normalized = toStrOrNull(v)?.trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return Boolean(normalized);
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const normalized = toStr(v).trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCustomKey(value: string): string {
  const withoutPercent = value.replace(/%/g, " percent ");
  const ascii = withoutPercent
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
  const words = ascii.match(/[a-zA-Z0-9]+/g) ?? ["field"];
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join("");
}

function parseFixedWidthValue(
  raw: string,
  formatting: string | null,
  defaultValue: string | null,
): unknown {
  const value = raw.trim();
  if (!value) return defaultValue ?? null;

  switch (formatting) {
    case "AJN":
      return ["J", "Y", "1", "TRUE", "WAHR"].includes(value.toUpperCase());
    case "R0":
      return Math.trunc(toNumberOrNull(value) ?? Number(defaultValue ?? 0));
    case "R":
    case "R2":
      return toNumberOrNull(value) ?? (defaultValue === null ? null : toNumberOrNull(defaultValue));
    default:
      return value;
  }
}

type BuerowareTargetEntity = "article" | "address" | "article_group" | "document" | "document_line";
type PostedBuerowareEntity = "article" | "address" | "article_group";

interface BuerowareFieldCatalogEntry {
  targetField: string;
  targetEntity?: BuerowareTargetEntity;
  referenceEntity?: BuerowareTargetEntity;
  required?: boolean;
}

const BUEROWARE_FIELD_CATALOG: Record<string, BuerowareFieldCatalogEntry> = {
  ART_1_25: { targetField: "articleNo", targetEntity: "article", required: true },
  ART_36_5: {
    targetField: "articleGroupId",
    targetEntity: "article",
    referenceEntity: "article_group",
  },
  ART_51_60: { targetField: "name", targetEntity: "article", required: true },
  ART_138_8: { targetField: "supplierId", targetEntity: "article", referenceEntity: "address" },
  ADR_2_8: { targetField: "addressNo", targetEntity: "address", required: true },
  ADR_20_30: { targetField: "companyName", targetEntity: "address" },
  ADR_80_30: { targetField: "addressLine1", targetEntity: "address" },
  ADR_110_10: { targetField: "postalCode", targetEntity: "address" },
  ADR_120_30: { targetField: "city", targetEntity: "address" },
  ADR_1450_3: { targetField: "countryCode", targetEntity: "address" },
  ADR_317_30: { targetField: "salutation", targetEntity: "address" },
  ADR_2332_20: { targetField: "phoneLandline", targetEntity: "address" },
  ADR_242_20: { targetField: "phoneFax", targetEntity: "address" },
  ADR_1114_20: { targetField: "phoneMobile", targetEntity: "address" },
  ADR_1330_60: { targetField: "email", targetEntity: "address" },
  ADR_1390_60: { targetField: "homepage", targetEntity: "address" },
  ADR_392_5: { targetField: "commissionRate", targetEntity: "address" },
  ADR_3201_6: { targetField: "creditRatingScore", targetEntity: "address" },
  ADR_2304_1: { targetField: "shopFaehig", targetEntity: "address" },
  ADR_2305_1: { targetField: "shopGesperrt", targetEntity: "address" },
  ADR_466_8: { targetField: "customAttributes.agentNo", targetEntity: "address" },
  WGR_1_5: { targetField: "code", targetEntity: "article_group", required: true },
  WGR_6_60: { targetField: "name", targetEntity: "article_group", required: true },
  BEL_2_1: { targetField: "documentType", targetEntity: "document", required: true },
  BEL_3_8: { targetField: "documentNo", targetEntity: "document", required: true },
  BEL_11_8: { targetField: "addressNo", targetEntity: "document" },
  BEL_19_10: { targetField: "documentDate", targetEntity: "document" },
  BEL_232_8: { targetField: "customAttributes.agentNo", targetEntity: "document" },
  BEL_240_5: { targetField: "commissionRate", targetEntity: "document" },
  BEL_393_12: { targetField: "totalNet", targetEntity: "document" },
  BEL_405_12: { targetField: "totalTax", targetEntity: "document" },
  BEL_417_12: { targetField: "totalGross", targetEntity: "document" },
  POS_2_1: { targetField: "documentType", targetEntity: "document_line", required: true },
  POS_3_8: { targetField: "documentNo", targetEntity: "document_line", required: true },
  POS_11_6: { targetField: "lineNo", targetEntity: "document_line", required: true },
  POS_18_25: { targetField: "articleNo", targetEntity: "document_line" },
  POS_45_60: { targetField: "articleTextSnapshot", targetEntity: "document_line" },
  POS_164_8: { targetField: "quantity", targetEntity: "document_line" },
  POS_246_9: { targetField: "netPrice", targetEntity: "document_line" },
  POS_280_12: { targetField: "lineTotalNet", targetEntity: "document_line" },
};

const articlePayloadSchema = z.object({
  articleNo: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const addressPayloadSchema = z.object({
  addressNo: z.string().trim().min(1),
});

const articleGroupPayloadSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

const documentPayloadSchema = z.object({
  documentType: z.string().trim().min(1),
  documentNo: z.string().trim().min(1),
});

const documentLinePayloadSchema = z.object({
  documentType: z.string().trim().min(1),
  documentNo: z.string().trim().min(1),
  lineNo: z.union([z.string().trim().min(1), z.number()]),
});

function isFilledBusinessKey(targetEntity: string, payload: Record<string, unknown>): boolean {
  const normalizedTargetEntity = normalizeTargetEntity(targetEntity);
  if (normalizedTargetEntity === "document") {
    return Boolean(toStrOrNull(payload.documentType)?.trim() && toStrOrNull(payload.documentNo)?.trim());
  }
  if (normalizedTargetEntity === "document_line") {
    return Boolean(
      toStrOrNull(payload.documentType)?.trim() &&
        toStrOrNull(payload.documentNo)?.trim() &&
        toStrOrNull(payload.lineNo)?.trim(),
    );
  }
  return true;
}

function parseFieldPosition(rowValue: string | undefined, fieldId: string): number | null {
  const parsed = Number.parseInt(rowValue ?? "", 10);
  if (Number.isFinite(parsed)) return parsed;
  const match = /_(\d+)_(\d+)$/.exec(fieldId);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseFieldLength(rowValue: string | undefined, fieldId: string): number | null {
  const parsed = Number.parseInt(rowValue ?? "", 10);
  if (Number.isFinite(parsed)) return parsed;
  const match = /_(\d+)_(\d+)$/.exec(fieldId);
  return match ? Number.parseInt(match[2], 10) : null;
}

function normalizeTargetEntity(targetEntity: string): string {
  if (targetEntity === "documentLine") return "document_line";
  if (targetEntity === "articleGroup") return "article_group";
  return targetEntity;
}

const ARTICLE_NATIVE_FIELDS = new Set([
  "articleNo",
  "name",
  "description",
  "articleGroupId",
  "customAttributes",
]);

const ARTICLE_UPDATE_FIELDS = ["description", "articleGroupId"] as const;

const ADDRESS_NATIVE_FIELDS = new Set([
  "addressNo",
  "companyName",
  "firstName",
  "lastName",
  "addressLine1",
  "postalCode",
  "city",
  "countryCode",
  "salutation",
  "phoneLandline",
  "phoneFax",
  "phoneMobile",
  "email",
  "homepage",
  "commissionRate",
  "creditRatingScore",
  "shopFaehig",
  "shopGesperrt",
  "customAttributes",
]);

const ADDRESS_UPDATE_FIELDS = [
  "companyName",
  "firstName",
  "lastName",
  "addressLine1",
  "postalCode",
  "city",
  "countryCode",
  "salutation",
  "phoneLandline",
  "phoneFax",
  "phoneMobile",
  "email",
  "homepage",
  "commissionRate",
  "creditRatingScore",
  "shopActive",
] as const;

function collectCustomAttributes(
  payload: Record<string, unknown>,
  nativeFields: Set<string>,
): Record<string, unknown> {
  const customAttributes = {
    ...((payload.customAttributes as Record<string, unknown> | undefined) ?? {}),
  };
  for (const [key, value] of Object.entries(payload)) {
    if (!nativeFields.has(key)) {
      customAttributes[key] = value;
    }
  }
  return customAttributes;
}

function normalizeArticlePayload(payload: Record<string, unknown>) {
  const customAttributes = collectCustomAttributes(payload, ARTICLE_NATIVE_FIELDS);
  return {
    tenantId: "",
    articleNo: toStr(payload.articleNo),
    name: toStr(payload.name),
    description: toStrOrNull(payload.description),
    articleGroupId: toStrOrNull(payload.articleGroupId),
    customAttributes,
  };
}

function normalizeAddressPayload(payload: Record<string, unknown>) {
  const customAttributes = collectCustomAttributes(payload, ADDRESS_NATIVE_FIELDS);
  const shopFaehig = toBoolOrNull(payload.shopFaehig);
  const shopGesperrt = toBoolOrNull(payload.shopGesperrt);
  const shopActive =
    shopFaehig !== null || shopGesperrt !== null
      ? (shopFaehig ?? true) && !(shopGesperrt ?? false)
      : undefined;
  const commissionRateNum = toNumberOrNull(payload.commissionRate);

  return {
    tenantId: "",
    addressNo: toStr(payload.addressNo),
    companyName: toStrOrNull(payload.companyName),
    firstName: toStrOrNull(payload.firstName),
    lastName: toStrOrNull(payload.lastName),
    addressLine1: toStr(payload.addressLine1 ?? payload.companyName ?? payload.addressNo),
    postalCode: toStr(payload.postalCode ?? "00000"),
    city: toStr(payload.city ?? "Unbekannt"),
    countryCode: toStr(payload.countryCode ?? "DE").slice(0, 2),
    salutation: toStrOrNull(payload.salutation),
    phoneLandline: toStrOrNull(payload.phoneLandline),
    phoneFax: toStrOrNull(payload.phoneFax),
    phoneMobile: toStrOrNull(payload.phoneMobile),
    email: toStrOrNull(payload.email),
    homepage: toStrOrNull(payload.homepage),
    commissionRate: commissionRateNum !== null ? String(commissionRateNum) : undefined,
    creditRatingScore: toStrOrNull(payload.creditRatingScore),
    shopActive,
    customAttributes,
  };
}

function normalizeArticleGroupPayload(payload: Record<string, unknown>) {
  return {
    tenantId: "",
    code: toStr(payload.code),
    name: toStr(payload.name),
  };
}

/**
 * Maps a Büroware "Datenbereich" (data area) to the platform target entity in the
 * snake_case form used by the import pipeline. Unmapped areas resolve to null,
 * meaning every field defaults to custom attributes until the user assigns targets.
 */
const BUEROWARE_DATA_AREA_TARGET_ENTITY: Record<string, string> = {
  Artikel: "article",
  Warengruppe: "article_group",
  Adressen: "address",
  Lieferadressen: "delivery_address",
  Ansprechpartner: "address_contact",
  Belege: "document",
  Positionen: "document_line",
};

/** snake_case pipeline entity → camelCase schema/metadata entity (for getEffectiveFields). */
export function buerowareEntityToMetadataEntity(targetEntity: string): string {
  return targetEntity.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function slugifyTemplate(value: string): string {
  const ascii = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
  const words = ascii.match(/[a-zA-Z0-9]+/g) ?? ["template"];
  return words.map((w) => w.toLowerCase()).join("-");
}

function normalizeBuerowareFileName(fileName: string): string {
  return fileName.trim().split(/[\\/]/).pop()?.toUpperCase() ?? fileName.trim().toUpperCase();
}

async function resolveUnitIdByCode(tenantId: string, code: unknown) {
  const unitCode = toStrOrNull(code)?.trim();
  if (!unitCode) return null;

  const [row] = await db
    .select({ unitId: unit.unitId })
    .from(unit)
    .where(and(eq(unit.tenantId, tenantId), eq(unit.code, unitCode)))
    .limit(1);

  return row?.unitId ?? null;
}

async function resolveArticleIdByNo(tenantId: string, articleNo: unknown) {
  const articleCode = toStrOrNull(articleNo)?.trim();
  if (!articleCode) return null;

  const [row] = await db
    .select({ articleId: article.articleId })
    .from(article)
    .where(and(eq(article.tenantId, tenantId), eq(article.articleNo, articleCode)))
    .limit(1);

  return row?.articleId ?? null;
}

async function resolveVariantIdentity(
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<{ variantId: string; articleId: string; sku: string } | null> {
  const directVariantId = toStrOrNull(payload.variantId)?.trim();
  if (directVariantId) {
    const [row] = await db
      .select({
        variantId: articleVariant.variantId,
        articleId: articleVariant.articleId,
        sku: articleVariant.sku,
      })
      .from(articleVariant)
      .where(
        and(eq(articleVariant.tenantId, tenantId), eq(articleVariant.variantId, directVariantId)),
      )
      .limit(1);

    if (row) return row;
  }

  const sku = toStrOrNull(payload.sku)?.trim();
  if (sku) {
    const [row] = await db
      .select({
        variantId: articleVariant.variantId,
        articleId: articleVariant.articleId,
        sku: articleVariant.sku,
      })
      .from(articleVariant)
      .where(and(eq(articleVariant.tenantId, tenantId), eq(articleVariant.sku, sku)))
      .limit(1);

    if (row) return row;
  }

  const articleId = toStrOrNull(payload.articleId)?.trim();
  const optionValueHash = toStrOrNull(payload.optionValueHash)?.trim();
  if (!articleId || !optionValueHash) return null;

  const [row] = await db
    .select({
      variantId: articleVariant.variantId,
      articleId: articleVariant.articleId,
      sku: articleVariant.sku,
    })
    .from(articleVariant)
    .where(
      and(
        eq(articleVariant.tenantId, tenantId),
        eq(articleVariant.articleId, articleId),
        eq(articleVariant.optionValueHash, optionValueHash),
      ),
    )
    .limit(1);

  return row ?? null;
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
      .where(
        and(eq(importProfile.profileId, profileId), eq(importProfile.tenantId, this.tenantId)),
      );
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

  async saveMappings(
    tenantConnectorId: string,
    profileId: string,
    rows: MappingRow[],
  ): Promise<void> {
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
            defaultValue:
              r.defaultValue !== undefined ? (r.defaultValue as Record<string, unknown>) : null,
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

  async bootstrapBuerowareMapping(params: {
    profileId: string;
    tenantConnectorId: string;
    schemaCsvText: string;
    targetFileName: string;
    delimiter?: string;
  }): Promise<{ versionId: string; versionNo: number; fieldCount: number }> {
    const { profileId, tenantConnectorId, schemaCsvText, targetFileName, delimiter = ";" } = params;

    const [profile] = await db
      .select()
      .from(importProfile)
      .where(and(eq(importProfile.profileId, profileId), eq(importProfile.tenantId, this.tenantId)))
      .limit(1);
    if (!profile) throw new Error("Import profile not found");

    const rows = parseCSV(schemaCsvText, delimiter);
    if (rows.length < 2) throw new Error("Satzbeschreibung.csv is empty");

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => {
      for (const name of names) {
        const index = headers.indexOf(name.toLowerCase());
        if (index >= 0) return index;
      }
      return -1;
    };

    const fileIdx = col("datei", "file");
    const fieldIdIdx = col("feldid", "feld-id", "feld id");
    const labelIdx = col("bezeichnung", "name", "feldbezeichnung");
    const posIdx = col("pos", "position");
    const lengthIdx = col("länge", "laenge", "length");
    const qualifierIdx = col("satzkürzel", "satzkuerzel", "satzkuerzel", "qualifier");
    const formattingIdx = col("formatierung", "formatting");

    if (fileIdx < 0 || fieldIdIdx < 0 || posIdx < 0 || lengthIdx < 0 || qualifierIdx < 0) {
      throw new Error("Satzbeschreibung.csv is missing required columns");
    }

    const selectedRows = rows.slice(1).filter((row) => row[fileIdx]?.trim() === targetFileName);
    if (selectedRows.length === 0) {
      throw new Error(`No schema rows found for ${targetFileName}`);
    }

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

    return await db.transaction(async (tx) => {
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

      const [version] = await tx
        .insert(importProfileMappingVersion)
        .values({
          tenantId: this.tenantId,
          tenantConnectorId,
          profileId,
          versionNo: nextVersionNo,
          mappings: [],
          isActive: true,
          activatedAt: new Date(),
          activatedBy: this.userId,
        })
        .returning();

      const hasUnqualifiedRows = selectedRows.some((row) => row[qualifierIdx]?.trim() === "*");
      const hasQualifiedRows = selectedRows.some((row) => {
        const rawQualifier = row[qualifierIdx]?.trim();
        return Boolean(rawQualifier && rawQualifier !== "*");
      });
      if (hasUnqualifiedRows && hasQualifiedRows) {
        throw new Error("Büroware mapping cannot mix qualified and unqualified rows");
      }

      const fields = selectedRows.map((row) => {
        const fieldId = row[fieldIdIdx]?.trim() ?? "";
        const label = row[labelIdx]?.trim() || fieldId;
        const catalog = BUEROWARE_FIELD_CATALOG[fieldId];
        const targetField = catalog?.targetField ?? `customAttributes.${normalizeCustomKey(label)}`;
        const rawQualifier = row[qualifierIdx]?.trim() || null;
        return {
          tenantId: this.tenantId,
          versionId: version.versionId,
          position: parseFieldPosition(row[posIdx], fieldId),
          length: parseFieldLength(row[lengthIdx], fieldId),
          qualifier: rawQualifier === "*" ? null : rawQualifier,
          formatting: formattingIdx >= 0 ? row[formattingIdx]?.trim() || null : null,
          sourceField: fieldId,
          targetField,
          targetEntity: catalog?.targetEntity ?? profile.targetEntity,
          referenceEntity: catalog?.referenceEntity ?? null,
          isRequired: catalog?.required ?? false,
        };
      });

      await tx.insert(importFieldMapping).values(fields);
      return { versionId: version.versionId, versionNo: version.versionNo, fieldCount: fields.length };
    });
  }

  /**
   * Loads the entire Satzbeschreibung.csv as a central, versioned catalog:
   *  - one `bueroware_record_layout` per data area = (file, Satzkürzel)
   *  - one `bueroware_record_field` per field definition
   *  - a central default mapping version (tenantId NULL) per layout, with
   *    importFieldMapping rows for every field whose FeldId is in the known catalog.
   * Re-runnable: each load deactivates prior layouts/defaults and bumps catalogVersion.
   */
  async loadBuerowareCatalog(params: { schemaCsvText: string; delimiter?: string }): Promise<{
    catalogVersion: number;
    layouts: Array<{
      layoutId: string;
      fileName: string;
      dataArea: string;
      qualifier: string | null;
      targetEntity: string | null;
      fieldCount: number;
      mappedFieldCount: number;
    }>;
  }> {
    const { schemaCsvText, delimiter = "," } = params;
    const rows = parseCSV(schemaCsvText, delimiter);
    if (rows.length < 2) throw new Error("Satzbeschreibung.csv is empty");

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => {
      for (const name of names) {
        const index = headers.indexOf(name.toLowerCase());
        if (index >= 0) return index;
      }
      return -1;
    };

    const dataAreaIdx = col("datenbereich", "data area");
    const qualifierIdx = col("satzkürzel", "satzkuerzel", "qualifier");
    const fileIdx = col("datei", "file");
    const labelIdx = col("bezeichnung", "name", "feldbezeichnung");
    const sampleIdx = col("feldinhalt", "beispiel", "sample");
    const posIdx = col("pos", "position");
    const lengthIdx = col("länge", "laenge", "length");
    const formattingIdx = col("formatierung", "formatting");
    const fieldIdIdx = col("feldid", "feld-id", "feld id");
    const refreshIdx = col("refreshtabelle", "refresh");
    const importMarkerIdx = col("importkennzeichen");
    const ordinalIdx = col("laufende nummer", "lfd. nummer", "lfd nummer", "ordinal");

    if (
      fileIdx < 0 ||
      fieldIdIdx < 0 ||
      dataAreaIdx < 0 ||
      qualifierIdx < 0 ||
      posIdx < 0 ||
      lengthIdx < 0
    ) {
      throw new Error(
        "Satzbeschreibung.csv is missing required columns (Datei, FeldId, Datenbereich, Satzkürzel, Pos, Länge)",
      );
    }

    interface Group {
      fileName: string;
      dataArea: string;
      qualifier: string | null; // '*' normalized to null (unqualified, absolute positions)
      rawRows: string[][];
    }
    const groups = new Map<string, Group>();
    for (const row of rows.slice(1)) {
      const fileName = normalizeBuerowareFileName(row[fileIdx] ?? "");
      const fieldId = row[fieldIdIdx]?.trim();
      if (!fileName || !fieldId) continue; // skip blank/artifact rows
      const rawQualifier = row[qualifierIdx]?.trim() || null;
      const qualifier = rawQualifier === "*" ? null : rawQualifier;
      const dataArea = row[dataAreaIdx]?.trim() || fileName;
      const key = `${fileName}::${rawQualifier ?? "*"}`;
      const group = groups.get(key) ?? { fileName, dataArea, qualifier, rawRows: [] };
      group.rawRows.push(row);
      groups.set(key, group);
    }
    if (groups.size === 0) throw new Error("No usable rows found in Satzbeschreibung.csv");

    return await db.transaction(async (tx) => {
      const [maxRow] = await tx
        .select({ maxVersion: max(buerowareRecordLayout.catalogVersion) })
        .from(buerowareRecordLayout);
      const catalogVersion = (maxRow?.maxVersion ?? 0) + 1;

      // Reloading the Satzbeschreibung replaces the whole catalog; retire prior data.
      await tx
        .update(buerowareRecordLayout)
        .set({ isActive: false })
        .where(eq(buerowareRecordLayout.isActive, true));
      await tx
        .update(importProfileMappingVersion)
        .set({ isActive: false })
        .where(
          and(
            isNull(importProfileMappingVersion.tenantId),
            eq(importProfileMappingVersion.sourceSystem, "bueroware"),
            eq(importProfileMappingVersion.isActive, true),
          ),
        );

      const layouts: Array<{
        layoutId: string;
        fileName: string;
        dataArea: string;
        qualifier: string | null;
        targetEntity: string | null;
        fieldCount: number;
        mappedFieldCount: number;
      }> = [];

      for (const group of groups.values()) {
        const targetEntity = BUEROWARE_DATA_AREA_TARGET_ENTITY[group.dataArea] ?? null;

        const [layout] = await tx
          .insert(buerowareRecordLayout)
          .values({
            fileName: group.fileName,
            dataArea: group.dataArea,
            qualifier: group.qualifier,
            defaultTargetEntity: targetEntity,
            catalogVersion,
            isActive: true,
            fieldCount: group.rawRows.length,
          })
          .returning();

        const fieldValues = group.rawRows.map((row) => {
          const fieldId = row[fieldIdIdx]!.trim();
          const catalog = BUEROWARE_FIELD_CATALOG[fieldId];
          return {
            layoutId: layout.layoutId,
            buerowareFieldId: fieldId,
            label: labelIdx >= 0 ? row[labelIdx]?.trim() || null : null,
            sampleValue: sampleIdx >= 0 ? row[sampleIdx]?.trim() || null : null,
            position: parseFieldPosition(row[posIdx], fieldId),
            length: parseFieldLength(row[lengthIdx], fieldId),
            formatting: formattingIdx >= 0 ? row[formattingIdx]?.trim() || null : null,
            refreshTable: refreshIdx >= 0 ? row[refreshIdx]?.trim() || null : null,
            importMarker: importMarkerIdx >= 0 ? row[importMarkerIdx]?.trim() || null : null,
            ordinal:
              ordinalIdx >= 0 ? Number.parseInt(row[ordinalIdx] ?? "", 10) || null : null,
            defaultTargetField: catalog?.targetField ?? null,
            defaultReferenceEntity: catalog?.referenceEntity ?? null,
          };
        });
        for (let i = 0; i < fieldValues.length; i += 500) {
          await tx.insert(buerowareRecordField).values(fieldValues.slice(i, i + 500));
        }

        // Central default mapping version: assign every field with a known catalog target.
        const [version] = await tx
          .insert(importProfileMappingVersion)
          .values({
            tenantId: null,
            tenantConnectorId: null,
            profileId: null,
            sourceSystem: "bueroware",
            sourceFileName: group.fileName,
            targetEntity,
            layoutId: layout.layoutId,
            versionNo: 1,
            mappings: [],
            isActive: true,
            activatedAt: new Date(),
            activatedBy: this.userId,
          })
          .returning();

        const mappingRows = fieldValues
          .filter((f) => f.defaultTargetField)
          .map((f) => {
            const catalog = BUEROWARE_FIELD_CATALOG[f.buerowareFieldId];
            return {
              tenantId: null,
              versionId: version.versionId,
              position: f.position,
              length: f.length,
              qualifier: group.qualifier,
              formatting: f.formatting,
              sourceField: f.buerowareFieldId,
              targetField: f.defaultTargetField!,
              targetEntity: catalog?.targetEntity ?? targetEntity,
              referenceEntity: f.defaultReferenceEntity,
              isRequired: catalog?.required ?? false,
            };
          });
        if (mappingRows.length > 0) {
          await tx.insert(importFieldMapping).values(mappingRows);
        }

        layouts.push({
          layoutId: layout.layoutId,
          fileName: group.fileName,
          dataArea: group.dataArea,
          qualifier: group.qualifier,
          targetEntity,
          fieldCount: group.rawRows.length,
          mappedFieldCount: mappingRows.length,
        });
      }

      return { catalogVersion, layouts };
    });
  }

  /** Active data areas (layouts) registered for an uploaded Büroware file. */
  async listLayoutsForFile(fileName: string) {
    const normalized = normalizeBuerowareFileName(fileName);
    return db
      .select()
      .from(buerowareRecordLayout)
      .where(
        and(
          eq(buerowareRecordLayout.fileName, normalized),
          eq(buerowareRecordLayout.isActive, true),
        ),
      )
      .orderBy(buerowareRecordLayout.dataArea);
  }

  /**
   * Resolves the mapping version to pre-fill a field-assignment view for a layout:
   * explicit version → tenant template (profile) → tenant default → central default.
   */
  private async resolveMappingVersionForLayout(
    layoutId: string,
    opts?: { mappingVersionId?: string; templateProfileId?: string },
  ): Promise<string | null> {
    if (opts?.mappingVersionId) return opts.mappingVersionId;

    if (opts?.templateProfileId) {
      const [row] = await db
        .select({ versionId: importProfileMappingVersion.versionId })
        .from(importProfileMappingVersion)
        .where(
          and(
            eq(importProfileMappingVersion.tenantId, this.tenantId),
            eq(importProfileMappingVersion.profileId, opts.templateProfileId),
            eq(importProfileMappingVersion.layoutId, layoutId),
            eq(importProfileMappingVersion.isActive, true),
          ),
        )
        .limit(1);
      if (row) return row.versionId;
    }

    const [central] = await db
      .select({ versionId: importProfileMappingVersion.versionId })
      .from(importProfileMappingVersion)
      .where(
        and(
          isNull(importProfileMappingVersion.tenantId),
          eq(importProfileMappingVersion.sourceSystem, "bueroware"),
          eq(importProfileMappingVersion.layoutId, layoutId),
          eq(importProfileMappingVersion.isActive, true),
        ),
      )
      .limit(1);
    return central?.versionId ?? null;
  }

  /**
   * Hybrid field view: every catalog field (with example value) joined with the
   * resolved target assignment. Drives the assignment mask in the UI.
   */
  async getLayoutFields(
    layoutId: string,
    opts?: { mappingVersionId?: string; templateProfileId?: string },
  ) {
    const [layout] = await db
      .select()
      .from(buerowareRecordLayout)
      .where(eq(buerowareRecordLayout.layoutId, layoutId))
      .limit(1);
    if (!layout) throw new Error("Büroware layout not found");

    const fields = await db
      .select()
      .from(buerowareRecordField)
      .where(eq(buerowareRecordField.layoutId, layoutId))
      .orderBy(buerowareRecordField.ordinal, buerowareRecordField.position);

    const versionId = await this.resolveMappingVersionForLayout(layoutId, opts);
    const assignments = versionId
      ? await db
          .select()
          .from(importFieldMapping)
          .where(eq(importFieldMapping.versionId, versionId))
      : [];
    const bySource = new Map(assignments.map((a) => [a.sourceField, a]));

    // Effective tenant target fields for the assignment dropdown ("Zielfeld des Tenants").
    const metadataEntity = layout.defaultTargetEntity
      ? buerowareEntityToMetadataEntity(layout.defaultTargetEntity)
      : null;
    let targetFields: Array<{
      fieldName: string;
      label: unknown;
      fieldType?: unknown;
      isUuid?: boolean;
      isRequired?: boolean;
    }> = [];
    if (metadataEntity) {
      try {
        const resolver = new MetadataResolver({ tenantId: this.tenantId, userId: this.userId });
        const effective = (await resolver.getEffectiveFields(
          metadataEntity,
        )) as Array<Record<string, unknown>>;
        targetFields = effective
          .filter((f) => f.isVisible !== false)
          .map((f) => ({
            fieldName: String(f.fieldName),
            label: f.labelDe ?? f.labelEn ?? f.fieldName,
            fieldType: f.fieldType,
            isUuid: Boolean(f.isUuid),
            isRequired: Boolean(f.isRequired),
          }));
      } catch {
        targetFields = [];
      }
    }

    return {
      layout,
      targetEntity: layout.defaultTargetEntity,
      metadataEntity,
      targetFields,
      resolvedVersionId: versionId,
      fields: fields.map((f) => {
        const a = bySource.get(f.buerowareFieldId);
        return {
          fieldId: f.fieldId,
          buerowareFieldId: f.buerowareFieldId,
          label: f.label,
          sampleValue: f.sampleValue,
          position: f.position,
          length: f.length,
          formatting: f.formatting,
          refreshTable: f.refreshTable,
          included: Boolean(a),
          targetField: a?.targetField ?? f.defaultTargetField ?? null,
          targetEntity: a?.targetEntity ?? layout.defaultTargetEntity,
          referenceEntity: a?.referenceEntity ?? f.defaultReferenceEntity ?? null,
        };
      }),
    };
  }

  /** Tenant import templates (Importvorlagen) available for a layout's dropdown. */
  async listBuerowareTemplates(layoutId: string) {
    return db
      .select({
        profileId: importProfile.profileId,
        label: importProfile.label,
        slug: importProfile.slug,
        versionId: importProfileMappingVersion.versionId,
        versionNo: importProfileMappingVersion.versionNo,
      })
      .from(importProfileMappingVersion)
      .innerJoin(
        importProfile,
        eq(importProfile.profileId, importProfileMappingVersion.profileId),
      )
      .where(
        and(
          eq(importProfileMappingVersion.tenantId, this.tenantId),
          eq(importProfileMappingVersion.layoutId, layoutId),
          eq(importProfileMappingVersion.isActive, true),
          eq(importProfile.archived, false),
        ),
      )
      .orderBy(desc(importProfileMappingVersion.createdAt));
  }

  /**
   * Saves a tenant import template (Importvorlage): an importProfile plus a new active
   * mapping version with importFieldMapping rows for the selected/assigned fields.
   * Positional metadata (position/length/formatting) is taken from the catalog.
   */
  async saveBuerowareTemplate(params: {
    layoutId: string;
    label: string;
    slug?: string;
    fields: Array<{
      buerowareFieldId: string;
      targetField: string;
      targetEntity?: string;
      referenceEntity?: string | null;
    }>;
  }): Promise<{ profileId: string; versionId: string; fieldCount: number }> {
    const [layout] = await db
      .select()
      .from(buerowareRecordLayout)
      .where(eq(buerowareRecordLayout.layoutId, params.layoutId))
      .limit(1);
    if (!layout) throw new Error("Büroware layout not found");

    const catalogFields = await db
      .select()
      .from(buerowareRecordField)
      .where(eq(buerowareRecordField.layoutId, params.layoutId));
    const catalogBySource = new Map(catalogFields.map((f) => [f.buerowareFieldId, f]));

    const targetEntity = layout.defaultTargetEntity ?? "article";
    const slug =
      params.slug ?? `bw-${slugifyTemplate(layout.fileName)}-${slugifyTemplate(layout.dataArea)}-${slugifyTemplate(params.label)}`;

    return await db.transaction(async (tx) => {
      const [profile] = await tx
        .insert(importProfile)
        .values({
          tenantId: this.tenantId,
          slug,
          label: params.label,
          targetEntity,
          targetCommandKey: `import.bueroware.${targetEntity}`,
          requiresApproval: true,
        })
        .onConflictDoUpdate({
          target: [importProfile.tenantId, importProfile.slug],
          set: { label: params.label, archived: false, updatedAt: new Date() },
        })
        .returning();

      const [maxResult] = await tx
        .select({ maxVersion: max(importProfileMappingVersion.versionNo) })
        .from(importProfileMappingVersion)
        .where(
          and(
            eq(importProfileMappingVersion.tenantId, this.tenantId),
            eq(importProfileMappingVersion.profileId, profile.profileId),
            eq(importProfileMappingVersion.layoutId, params.layoutId),
          ),
        );
      const nextVersionNo = (maxResult?.maxVersion ?? 0) + 1;

      await tx
        .update(importProfileMappingVersion)
        .set({ isActive: false })
        .where(
          and(
            eq(importProfileMappingVersion.tenantId, this.tenantId),
            eq(importProfileMappingVersion.profileId, profile.profileId),
            eq(importProfileMappingVersion.layoutId, params.layoutId),
            eq(importProfileMappingVersion.isActive, true),
          ),
        );

      const [version] = await tx
        .insert(importProfileMappingVersion)
        .values({
          tenantId: this.tenantId,
          profileId: profile.profileId,
          sourceSystem: "bueroware",
          sourceFileName: layout.fileName,
          targetEntity,
          layoutId: params.layoutId,
          versionNo: nextVersionNo,
          mappings: [],
          isActive: true,
          activatedAt: new Date(),
          activatedBy: this.userId,
        })
        .returning();

      const rows = params.fields
        .filter((f) => f.targetField)
        .map((f) => {
          const cat = catalogBySource.get(f.buerowareFieldId);
          return {
            tenantId: this.tenantId,
            versionId: version.versionId,
            position: cat?.position ?? null,
            length: cat?.length ?? null,
            qualifier: layout.qualifier,
            formatting: cat?.formatting ?? null,
            sourceField: f.buerowareFieldId,
            targetField: f.targetField,
            targetEntity: f.targetEntity ?? targetEntity,
            referenceEntity: f.referenceEntity ?? cat?.defaultReferenceEntity ?? null,
            isRequired: false,
          };
        });
      if (rows.length > 0) {
        await tx.insert(importFieldMapping).values(rows);
      }

      return { profileId: profile.profileId, versionId: version.versionId, fieldCount: rows.length };
    });
  }

  async queueBuerowareFile(params: {
    layoutId?: string;
    profileId?: string;
    mappingVersionId?: string;
    sourceFileName?: string;
    filePath: string;
    isDryRun?: boolean;
  }): Promise<{ batchId: string; status: string; needsLayoutSelection: boolean }> {
    const sourceFileName = params.sourceFileName
      ? normalizeBuerowareFileName(params.sourceFileName)
      : null;

    // Resolve which data area (layout) this file maps to. With several data areas
    // and no explicit choice, the batch waits in 'pending' until the user picks one.
    let layoutId = params.layoutId ?? null;
    let needsLayoutSelection = false;
    if (!layoutId && sourceFileName) {
      const layouts = await this.listLayoutsForFile(sourceFileName);
      if (layouts.length === 1) {
        layoutId = layouts[0].layoutId;
      } else if (layouts.length > 1) {
        needsLayoutSelection = true;
      }
    }

    const layout = layoutId
      ? (
          await db
            .select()
            .from(buerowareRecordLayout)
            .where(eq(buerowareRecordLayout.layoutId, layoutId))
            .limit(1)
        )[0]
      : undefined;

    // Resolve the mapping version (explicit → tenant template → central default).
    const mappingVersionId =
      params.mappingVersionId ??
      (layoutId
        ? await this.resolveMappingVersionForLayout(layoutId, {
            templateProfileId: params.profileId,
          })
        : null);

    const targetEntity = layout?.defaultTargetEntity ?? null;

    await mkdir(dirname(params.filePath), { recursive: true });

    const [batch] = await db
      .insert(importBatch)
      .values({
        tenantId: this.tenantId,
        profileId: params.profileId ?? null,
        layoutId,
        mappingVersionId,
        atomicityMode: "file",
        status: layoutId ? "queued" : "pending",
        isDryRun: params.isDryRun ?? true,
        filePath: params.filePath,
        sourceFileName,
        targetEntity,
        targetCommandKey: targetEntity
          ? `import.bueroware.${normalizeTargetEntity(targetEntity)}`
          : null,
      })
      .returning();

    return { batchId: batch.batchId, status: batch.status, needsLayoutSelection };
  }

  /**
   * Binds a chosen data area (layout) + mapping source to a pending batch and queues it.
   * Used after the user resolves a multi-data-area file or switches the template.
   */
  async selectBuerowareLayout(params: {
    batchId: string;
    layoutId: string;
    profileId?: string;
    mappingVersionId?: string;
  }): Promise<{ batchId: string; status: string }> {
    const [batch] = await db
      .select()
      .from(importBatch)
      .where(and(eq(importBatch.batchId, params.batchId), eq(importBatch.tenantId, this.tenantId)))
      .limit(1);
    if (!batch) throw new Error("Batch not found");
    if (batch.status !== "pending" && batch.status !== "queued") {
      throw new Error(`Batch data area cannot be changed in status: ${batch.status}`);
    }

    const [layout] = await db
      .select()
      .from(buerowareRecordLayout)
      .where(eq(buerowareRecordLayout.layoutId, params.layoutId))
      .limit(1);
    if (!layout) throw new Error("Büroware layout not found");

    const mappingVersionId =
      params.mappingVersionId ??
      (await this.resolveMappingVersionForLayout(params.layoutId, {
        templateProfileId: params.profileId,
      }));
    const targetEntity = layout.defaultTargetEntity ?? null;

    const [updated] = await db
      .update(importBatch)
      .set({
        layoutId: params.layoutId,
        mappingVersionId,
        profileId: params.profileId ?? batch.profileId,
        targetEntity,
        targetCommandKey: targetEntity
          ? `import.bueroware.${normalizeTargetEntity(targetEntity)}`
          : null,
        status: "queued",
      })
      .where(and(eq(importBatch.batchId, params.batchId), eq(importBatch.tenantId, this.tenantId)))
      .returning();

    return { batchId: updated.batchId, status: updated.status };
  }

  async runNextBuerowareImportJob(): Promise<{ batchId: string; status: string } | null> {
    // Raw RETURNING rows are snake_case; re-select through the ORM for a typed batch.
    const claimed = (await db.execute(sql`
      UPDATE import_batch
      SET status = 'processing'
      WHERE batch_id = (
        SELECT batch_id
        FROM import_batch
        WHERE tenant_id = ${this.tenantId}::uuid
          AND status = 'queued'
          AND file_path IS NOT NULL
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING batch_id
    `)) as Array<{ batch_id: string }>;

    const claimedId = claimed[0]?.batch_id;
    if (!claimedId) return null;

    const [batch] = await db
      .select()
      .from(importBatch)
      .where(and(eq(importBatch.batchId, claimedId), eq(importBatch.tenantId, this.tenantId)))
      .limit(1);
    if (!batch) return null;

    try {
      await this.ingestBuerowareBatchFile(batch);
      await this.resolveBuerowareBatch(batch.batchId, { dryRun: true });
      return { batchId: batch.batchId, status: "validated" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db
        .update(importBatch)
        .set({
          status: "failed",
          errorSummary: { message } as Record<string, unknown>,
          processedAt: new Date(),
        })
        .where(and(eq(importBatch.batchId, batch.batchId), eq(importBatch.tenantId, this.tenantId)));
      return { batchId: batch.batchId, status: "failed" };
    }
  }

  async ingestBuerowareBatchFile(batch: typeof importBatch.$inferSelect): Promise<number> {
    if (!batch.filePath) throw new Error("Batch has no file path");

    const layout = batch.layoutId
      ? (
          await db
            .select()
            .from(buerowareRecordLayout)
            .where(eq(buerowareRecordLayout.layoutId, batch.layoutId))
            .limit(1)
        )[0]
      : undefined;

    const mappingVersion =
      batch.mappingVersionId ??
      (batch.layoutId ? await this.resolveMappingVersionForLayout(batch.layoutId) : null) ??
      (batch.sourceFileName
        ? (
            await db
              .select({ versionId: importProfileMappingVersion.versionId })
              .from(importProfileMappingVersion)
              .where(
                and(
                  isNull(importProfileMappingVersion.tenantId),
                  eq(importProfileMappingVersion.sourceSystem, "bueroware"),
                  eq(
                    importProfileMappingVersion.sourceFileName,
                    normalizeBuerowareFileName(batch.sourceFileName),
                  ),
                  eq(importProfileMappingVersion.isActive, true),
                ),
              )
              .limit(1)
          )[0]?.versionId
        : null);
    if (!mappingVersion) {
      throw new Error(
        batch.sourceFileName
          ? `No active Büroware mapping found for ${normalizeBuerowareFileName(batch.sourceFileName)}`
          : "Batch has no mapping version",
      );
    }

    const mappings = await db
      .select()
      .from(importFieldMapping)
      .where(eq(importFieldMapping.versionId, mappingVersion));
    if (mappings.length === 0) throw new Error("Mapping version has no field mappings");

    await db
      .delete(importRow)
      .where(and(eq(importRow.batchId, batch.batchId), eq(importRow.tenantId, this.tenantId)));

    // A mapping version maps exactly one data area (one layout) → one qualifier.
    const qualifier =
      layout?.qualifier ?? mappings.map((m) => m.qualifier).find((q) => q !== null) ?? null;
    const isUnqualifiedFile = qualifier === null;

    const targetEntity = normalizeTargetEntity(
      layout?.defaultTargetEntity ??
        mappings.find((m) => m.targetEntity)?.targetEntity ??
        batch.targetEntity ??
        "article",
    );

    // Büroware SEDB files are fixed-width CP1252; read as latin1 so 1 byte = 1 char.
    // UTF-8 decoding would corrupt umlauts AND shift every downstream fixed-width position.
    const rl = readline.createInterface({
      input: createReadStream(batch.filePath, { encoding: "latin1" }),
      crlfDelay: Infinity,
    });

    let inserted = 0;
    let rowBuffer: Array<typeof importRow.$inferInsert> = [];
    for await (const line of rl) {
      if (!line.trim()) continue;

      let data = line;
      if (!isUnqualifiedFile) {
        if (line.length < 1 || line.charAt(0) !== qualifier) continue; // other data areas + header rows
        data = line.slice(1); // qualified positions are relative to the char after the qualifier
      }

      const payload: Record<string, unknown> = {};
      for (const mapping of mappings) {
        if (mapping.position === null || mapping.length === null) continue;
        const start = isUnqualifiedFile
          ? Math.max(mapping.position, 0)
          : Math.max(mapping.position - 1, 0);
        const raw = start >= data.length ? "" : data.substring(start, start + mapping.length);
        const parsed = parseFixedWidthValue(raw, mapping.formatting, mapping.defaultValue);
        const target = mapping.targetField;
        if (target.startsWith("customAttributes.")) {
          const key = target.slice("customAttributes.".length);
          payload.customAttributes = {
            ...((payload.customAttributes as Record<string, unknown> | undefined) ?? {}),
            [key]: parsed,
          };
        } else {
          payload[target] = parsed;
        }
      }

      if (!isFilledBusinessKey(targetEntity, payload)) continue;

      rowBuffer.push({
        tenantId: this.tenantId,
        batchId: batch.batchId,
        targetEntity,
        status: "pending",
        payload,
      });

      if (rowBuffer.length >= 1000) {
        await db.insert(importRow).values(rowBuffer);
        inserted += rowBuffer.length;
        rowBuffer = [];
      }
    }

    if (rowBuffer.length > 0) {
      await db.insert(importRow).values(rowBuffer);
      inserted += rowBuffer.length;
    }

    return inserted;
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
      .where(and(eq(importProfile.profileId, profileId), eq(importProfile.tenantId, this.tenantId)))
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
    if (
      batch.status !== "pending" &&
      batch.status !== "validating" &&
      batch.status !== "validated"
    ) {
      throw new Error(`Batch cannot be approved in status: ${batch.status}`);
    }

    await db
      .update(importBatch)
      .set({ status: "approved", isDryRun: false })
      .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)));
  }

  async resolveBuerowareBatch(
    batchId: string,
    options: { dryRun: boolean; triggerReconcile?: boolean },
  ): Promise<{ valid: number; posted: number; failed: number; pendingReferences: number }> {
    const [batch] = await db
      .select()
      .from(importBatch)
      .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)))
      .limit(1);
    if (!batch) throw new Error("Batch not found");
    const mappingVersion =
      batch.mappingVersionId ??
      (batch.sourceFileName
        ? (
            await db
              .select({ versionId: importProfileMappingVersion.versionId })
              .from(importProfileMappingVersion)
              .where(
                and(
                  isNull(importProfileMappingVersion.tenantId),
                  eq(importProfileMappingVersion.sourceSystem, "bueroware"),
                  eq(
                    importProfileMappingVersion.sourceFileName,
                    normalizeBuerowareFileName(batch.sourceFileName),
                  ),
                  eq(importProfileMappingVersion.isActive, true),
                ),
              )
              .limit(1)
          )[0]?.versionId
        : null);
    if (!mappingVersion) {
      throw new Error(
        batch.sourceFileName
          ? `No active Büroware mapping found for ${normalizeBuerowareFileName(batch.sourceFileName)}`
          : "Batch has no mapping version",
      );
    }

    const fieldMappings = await db
      .select()
      .from(importFieldMapping)
      .where(eq(importFieldMapping.versionId, mappingVersion));
    const referenceFields = fieldMappings.filter((mapping) => mapping.referenceEntity);

    let valid = 0;
    let posted = 0;
    let failed = 0;
    let pendingReferences = 0;
    const pageSize = 1000;

    while (true) {
      const rows = await db
        .select()
        .from(importRow)
        .where(
          and(
            eq(importRow.tenantId, this.tenantId),
            eq(importRow.batchId, batchId),
            inArray(importRow.status, options.dryRun ? ["pending"] : ["valid"]),
          ),
        )
        .limit(pageSize);

      if (rows.length === 0) break;

      const referenceLookup = await this.loadReferenceLookup(referenceFields, rows);
      const validRows: string[] = [];
      const pendingRows: Array<{ rowId: string; missing: Record<string, unknown> }> = [];
      const failedRows: Array<{ rowId: string; message: string }> = [];
      const postRows: Array<{
        rowId: string;
        targetEntity: PostedBuerowareEntity;
        payload: Record<string, unknown>;
      }> = [];

      for (const row of rows) {
        try {
          const payload = { ...(row.payload as Record<string, unknown>) };
          const missing: Record<string, unknown> = {};

          for (const mapping of referenceFields) {
            const externalKey = toStrOrNull(payload[mapping.targetField])?.trim();
            if (!externalKey || !mapping.referenceEntity) continue;
            const internalId = referenceLookup.get(
              `${mapping.referenceEntity}:${externalKey}`,
            );
            if (!internalId) {
              missing[mapping.targetField] = externalKey;
            } else {
              payload[mapping.targetField] = internalId;
            }
          }

          if (Object.keys(missing).length > 0) {
            pendingRows.push({ rowId: row.rowId, missing });
            pendingReferences++;
            continue;
          }

          this.validateBuerowarePayload(row.targetEntity, payload);

          if (options.dryRun) {
            validRows.push(row.rowId);
            valid++;
          } else {
            const normalizedTargetEntity = normalizeTargetEntity(row.targetEntity);
            if (
              normalizedTargetEntity !== "article" &&
              normalizedTargetEntity !== "address" &&
              normalizedTargetEntity !== "article_group"
            ) {
              throw new Error(`Unsupported Büroware target entity: ${row.targetEntity}`);
            }
            postRows.push({
              rowId: row.rowId,
              targetEntity: normalizedTargetEntity,
              payload,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failedRows.push({ rowId: row.rowId, message });
          failed++;
        }
      }

      if (validRows.length > 0) {
        await db
          .update(importRow)
          .set({ status: "valid", missingReferences: null, errorDetail: null })
          .where(inArray(importRow.rowId, validRows));
      }

      await this.markBuerowareRowsPendingReferences(pendingRows);
      await this.markBuerowareRowsFailed(failedRows);

      if (!options.dryRun && postRows.length > 0) {
        const postResult = await this.bulkUpsertBuerowarePayloads(postRows);
        posted += postResult.posted;
        failed += postResult.failed;
      }
    }

    const [pendingSummary] = (await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM import_row
      WHERE tenant_id = ${this.tenantId}::uuid
        AND batch_id = ${batchId}::uuid
        AND status = 'pending_references'
    `)) as Array<{ count: number }>;
    const totalPendingReferences = Number(pendingSummary?.count ?? 0);

    await db
      .update(importBatch)
      .set({
        status: options.dryRun
          ? "validated"
          : failed > 0
            ? "failed"
            : totalPendingReferences > 0
              ? "validated"
              : "posted",
        postedEntityCount: options.dryRun ? batch.postedEntityCount : posted,
        failedEntityCount: failed,
        pendingReferenceCount: totalPendingReferences,
        processedAt: new Date(),
      })
      .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)));

    if (!options.dryRun && posted > 0 && options.triggerReconcile !== false) {
      await this.reconcilePendingRows();
    }

    return { valid, posted, failed, pendingReferences: totalPendingReferences };
  }

  private async loadReferenceLookup(
    referenceFields: Array<typeof importFieldMapping.$inferSelect>,
    rows: Array<typeof importRow.$inferSelect>,
  ): Promise<Map<string, string>> {
    const keysByEntity = new Map<string, Set<string>>();
    for (const mapping of referenceFields) {
      if (!mapping.referenceEntity) continue;
      const keys = keysByEntity.get(mapping.referenceEntity) ?? new Set<string>();
      for (const row of rows) {
        const payload = row.payload as Record<string, unknown>;
        const value = toStrOrNull(payload[mapping.targetField])?.trim();
        if (value) keys.add(value);
      }
      keysByEntity.set(mapping.referenceEntity, keys);
    }

    const lookup = new Map<string, string>();
    for (const [entityType, keys] of keysByEntity.entries()) {
      if (keys.size === 0) continue;
      const mappings = await db
        .select({
          entityType: externalSyncMapping.entityType,
          externalId: externalSyncMapping.externalId,
          internalId: externalSyncMapping.internalId,
        })
        .from(externalSyncMapping)
        .where(
          and(
            eq(externalSyncMapping.tenantId, this.tenantId),
            eq(externalSyncMapping.sourceSystem, "bueroware"),
            eq(externalSyncMapping.entityType, entityType as "article" | "article_group" | "address"),
            inArray(externalSyncMapping.externalId, [...keys]),
          ),
        );
      for (const mapping of mappings) {
        lookup.set(`${mapping.entityType}:${mapping.externalId}`, mapping.internalId);
      }
    }
    return lookup;
  }

  private validateBuerowarePayload(targetEntity: string, payload: Record<string, unknown>): void {
    const normalizedTargetEntity = normalizeTargetEntity(targetEntity);
    if (normalizedTargetEntity === "article") {
      articlePayloadSchema.parse({
        ...payload,
        articleNo: toStrOrNull(payload.articleNo),
        name: toStrOrNull(payload.name),
      });
      return;
    }
    if (normalizedTargetEntity === "address") {
      addressPayloadSchema.parse({ ...payload, addressNo: toStrOrNull(payload.addressNo) });
      return;
    }
    if (normalizedTargetEntity === "article_group") {
      articleGroupPayloadSchema.parse({
        ...payload,
        code: toStrOrNull(payload.code),
        name: toStrOrNull(payload.name),
      });
      return;
    }
    if (normalizedTargetEntity === "document") {
      documentPayloadSchema.parse({
        ...payload,
        documentType: toStrOrNull(payload.documentType),
        documentNo: toStrOrNull(payload.documentNo),
      });
      return;
    }
    if (normalizedTargetEntity === "document_line") {
      documentLinePayloadSchema.parse({
        ...payload,
        documentType: toStrOrNull(payload.documentType),
        documentNo: toStrOrNull(payload.documentNo),
      });
      return;
    }
    throw new Error(`Unsupported Büroware target entity: ${targetEntity}`);
  }

  private async markBuerowareRowsPendingReferences(
    rows: Array<{ rowId: string; missing: Record<string, unknown> }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map(
      (row) => sql`(${row.rowId}::uuid, ${JSON.stringify(row.missing)}::jsonb)`,
    );
    await db.execute(sql`
      UPDATE import_row AS r
      SET
        status = 'pending_references',
        missing_references = v.missing_references,
        error_detail = NULL
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(row_id, missing_references)
      WHERE r.row_id = v.row_id
        AND r.tenant_id = ${this.tenantId}::uuid
    `);
  }

  private async markBuerowareRowsFailed(
    rows: Array<{ rowId: string; message: string }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map((row) =>
      sql`(${row.rowId}::uuid, ${JSON.stringify({ message: row.message })}::jsonb)`,
    );
    await db.execute(sql`
      UPDATE import_row AS r
      SET
        status = 'failed',
        error_detail = v.error_detail
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(row_id, error_detail)
      WHERE r.row_id = v.row_id
        AND r.tenant_id = ${this.tenantId}::uuid
    `);
  }

  private async markBuerowareRowsPosted(
    rows: Array<{ rowId: string; payload: Record<string, unknown> }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map((row) =>
      sql`(${row.rowId}::uuid, ${JSON.stringify(row.payload)}::jsonb)`,
    );
    await db.execute(sql`
      UPDATE import_row AS r
      SET
        status = 'posted',
        payload = v.payload,
        missing_references = NULL,
        error_detail = NULL,
        posted_at = NOW()
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(row_id, payload)
      WHERE r.row_id = v.row_id
        AND r.tenant_id = ${this.tenantId}::uuid
    `);
  }

  private async bulkUpsertBuerowarePayloads(
    rows: Array<{
      rowId: string;
      targetEntity: PostedBuerowareEntity;
      payload: Record<string, unknown>;
    }>,
  ): Promise<{ posted: number; failed: number }> {
    const successfulRows: Array<{
      rowId: string;
      targetEntity: PostedBuerowareEntity;
      payload: Record<string, unknown>;
      internalId: string;
    }> = [];
    const failedRows: Array<{ rowId: string; message: string }> = [];

    const articleRows = rows.filter((row) => row.targetEntity === "article");
    const articleGroupRows = rows.filter((row) => row.targetEntity === "article_group");
    const addressRows = rows.filter((row) => row.targetEntity === "address");

    try {
      const ids = await this.bulkUpsertArticles(articleRows);
      for (const row of articleRows) {
        const internalId = ids.get(this.externalIdForPayload(row.targetEntity, row.payload));
        if (internalId) {
          successfulRows.push({ ...row, internalId });
        } else {
          failedRows.push({ rowId: row.rowId, message: "Article bulk upsert returned no id" });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedRows.push(...articleRows.map((row) => ({ rowId: row.rowId, message })));
    }

    try {
      const ids = await this.bulkUpsertArticleGroups(articleGroupRows);
      for (const row of articleGroupRows) {
        const internalId = ids.get(this.externalIdForPayload(row.targetEntity, row.payload));
        if (internalId) {
          successfulRows.push({ ...row, internalId });
        } else {
          failedRows.push({
            rowId: row.rowId,
            message: "Article group bulk upsert returned no id",
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedRows.push(...articleGroupRows.map((row) => ({ rowId: row.rowId, message })));
    }

    try {
      const ids = await this.bulkUpsertAddresses(addressRows);
      for (const row of addressRows) {
        const internalId = ids.get(this.externalIdForPayload(row.targetEntity, row.payload));
        if (internalId) {
          successfulRows.push({ ...row, internalId });
        } else {
          failedRows.push({ rowId: row.rowId, message: "Address bulk upsert returned no id" });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedRows.push(...addressRows.map((row) => ({ rowId: row.rowId, message })));
    }

    try {
      await this.bulkRegisterExternalMappings(successfulRows);
      await this.markBuerowareRowsPosted(successfulRows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedRows.push(...successfulRows.map((row) => ({ rowId: row.rowId, message })));
      successfulRows.length = 0;
    }
    await this.markBuerowareRowsFailed(failedRows);

    return { posted: successfulRows.length, failed: failedRows.length };
  }

  private async bulkUpsertArticles(
    rows: Array<{ payload: Record<string, unknown> }>,
  ): Promise<Map<string, string>> {
    if (rows.length === 0) return new Map();

    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const updateFields = this.articleUpdateFieldsForPayload(row.payload);
      const key = updateFields.join("|");
      const group = groups.get(key) ?? [];
      group.push(row.payload);
      groups.set(key, group);
    }

    const ids = new Map<string, string>();
    for (const [key, payloads] of groups.entries()) {
      const updateFields = key ? (key.split("|") as Array<(typeof ARTICLE_UPDATE_FIELDS)[number]>) : [];
      const byExternalId = new Map<string, Record<string, unknown>>();
      for (const payload of payloads) {
        byExternalId.set(toStr(payload.articleNo), payload);
      }
      const values = [...byExternalId.values()].map((payload) => ({
        ...normalizeArticlePayload(payload),
        tenantId: this.tenantId,
      }));

      const set: Record<string, unknown> = {
        name: sql`excluded.name`,
        customAttributes: sql`excluded.custom_attributes`,
        updatedAt: new Date(),
      };
      for (const field of updateFields) {
        set[field] = this.articleExcludedColumn(field);
      }

      const result = await db
        .insert(article)
        .values(values)
        .onConflictDoUpdate({
          target: [article.tenantId, article.articleNo],
          set,
        })
        .returning({ externalId: article.articleNo, internalId: article.articleId });

      for (const row of result) {
        ids.set(row.externalId, row.internalId);
      }
    }

    await backfillDefaultArticleVariants(this.tenantId);
    return ids;
  }

  private articleUpdateFieldsForPayload(
    payload: Record<string, unknown>,
  ): Array<(typeof ARTICLE_UPDATE_FIELDS)[number]> {
    const fields: Array<(typeof ARTICLE_UPDATE_FIELDS)[number]> = [];
    for (const field of ARTICLE_UPDATE_FIELDS) {
      if (payload[field] !== undefined) {
        fields.push(field);
      }
    }
    return fields;
  }

  private articleExcludedColumn(field: (typeof ARTICLE_UPDATE_FIELDS)[number]) {
    switch (field) {
      case "description":
        return sql`excluded.description`;
      case "articleGroupId":
        return sql`excluded.article_group_id`;
    }
  }

  private async bulkUpsertArticleGroups(
    rows: Array<{ payload: Record<string, unknown> }>,
  ): Promise<Map<string, string>> {
    if (rows.length === 0) return new Map();
    const byExternalId = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      byExternalId.set(toStr(row.payload.code), row.payload);
    }
    const values = [...byExternalId.values()].map((payload) => ({
      ...normalizeArticleGroupPayload(payload),
      tenantId: this.tenantId,
    }));

    const result = await db
      .insert(articleGroup)
      .values(values)
      .onConflictDoUpdate({
        target: [articleGroup.tenantId, articleGroup.code],
        set: {
          name: sql`excluded.name`,
        },
      })
      .returning({ externalId: articleGroup.code, internalId: articleGroup.articleGroupId });

    return new Map(result.map((row) => [row.externalId, row.internalId]));
  }

  private async bulkUpsertAddresses(
    rows: Array<{ payload: Record<string, unknown> }>,
  ): Promise<Map<string, string>> {
    if (rows.length === 0) return new Map();

    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const updateFields = this.addressUpdateFieldsForPayload(row.payload);
      const key = updateFields.join("|");
      const group = groups.get(key) ?? [];
      group.push(row.payload);
      groups.set(key, group);
    }

    const ids = new Map<string, string>();
    for (const [key, payloads] of groups.entries()) {
      const updateFields = key ? (key.split("|") as Array<(typeof ADDRESS_UPDATE_FIELDS)[number]>) : [];
      const byExternalId = new Map<string, Record<string, unknown>>();
      for (const payload of payloads) {
        byExternalId.set(toStr(payload.addressNo), payload);
      }
      const values = [...byExternalId.values()].map((payload) => {
        const normalized = normalizeAddressPayload(payload);
        return {
          tenantId: this.tenantId,
          addressNo: normalized.addressNo,
          companyName: normalized.companyName,
          firstName: normalized.firstName,
          lastName: normalized.lastName,
          addressLine1: normalized.addressLine1,
          postalCode: normalized.postalCode,
          city: normalized.city,
          countryCode: normalized.countryCode,
          salutation: normalized.salutation,
          phoneLandline: normalized.phoneLandline,
          phoneFax: normalized.phoneFax,
          phoneMobile: normalized.phoneMobile,
          email: normalized.email,
          homepage: normalized.homepage,
          commissionRate: normalized.commissionRate,
          creditRatingScore: normalized.creditRatingScore,
          ...(normalized.shopActive !== undefined && { shopActive: normalized.shopActive }),
          customAttributes: normalized.customAttributes,
        };
      });

      const set: Record<string, unknown> = {
        customAttributes: sql`excluded.custom_attributes`,
        updatedAt: new Date(),
      };
      for (const field of updateFields) {
        set[field] = this.addressExcludedColumn(field);
      }

      const result = await db
        .insert(address)
        .values(values)
        .onConflictDoUpdate({
          target: [address.tenantId, address.addressNo],
          set,
        })
        .returning({ externalId: address.addressNo, internalId: address.addressId });

      for (const row of result) {
        ids.set(row.externalId, row.internalId);
      }
    }

    return ids;
  }

  private addressUpdateFieldsForPayload(
    payload: Record<string, unknown>,
  ): Array<(typeof ADDRESS_UPDATE_FIELDS)[number]> {
    const fields: Array<(typeof ADDRESS_UPDATE_FIELDS)[number]> = [];
    for (const field of ADDRESS_UPDATE_FIELDS) {
      if (field === "shopActive") {
        if (payload.shopFaehig !== undefined || payload.shopGesperrt !== undefined) {
          fields.push(field);
        }
        continue;
      }
      if (payload[field] !== undefined) {
        fields.push(field);
      }
    }
    return fields;
  }

  private addressExcludedColumn(field: (typeof ADDRESS_UPDATE_FIELDS)[number]) {
    switch (field) {
      case "companyName":
        return sql`excluded.company_name`;
      case "firstName":
        return sql`excluded.first_name`;
      case "lastName":
        return sql`excluded.last_name`;
      case "addressLine1":
        return sql`excluded.address_line_1`;
      case "postalCode":
        return sql`excluded.postal_code`;
      case "city":
        return sql`excluded.city`;
      case "countryCode":
        return sql`excluded.country_code`;
      case "salutation":
        return sql`excluded.salutation`;
      case "phoneLandline":
        return sql`excluded.phone_landline`;
      case "phoneFax":
        return sql`excluded.phone_fax`;
      case "phoneMobile":
        return sql`excluded.phone_mobile`;
      case "email":
        return sql`excluded.email`;
      case "homepage":
        return sql`excluded.homepage`;
      case "commissionRate":
        return sql`excluded.commission_rate`;
      case "creditRatingScore":
        return sql`excluded.credit_rating_score`;
      case "shopActive":
        return sql`excluded.shop_active`;
    }
  }

  private async bulkRegisterExternalMappings(
    rows: Array<{
      targetEntity: PostedBuerowareEntity;
      payload: Record<string, unknown>;
      internalId: string;
    }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const byMappingKey = new Map<
      string,
      {
        entityType: PostedBuerowareEntity;
        externalId: string;
        internalId: string;
        payload: Record<string, unknown>;
      }
    >();
    for (const row of rows) {
      const entityType = normalizeTargetEntity(row.targetEntity) as PostedBuerowareEntity;
      const externalId = this.externalIdForPayload(row.targetEntity, row.payload);
      byMappingKey.set(`${entityType}:${externalId}`, {
        entityType,
        externalId,
        internalId: row.internalId,
        payload: row.payload,
      });
    }

    await db
      .insert(externalSyncMapping)
      .values(
        [...byMappingKey.values()].map((row) => ({
          tenantId: this.tenantId,
          salesChannelId: null,
          sourceSystem: "bueroware",
          entityType: row.entityType,
          internalId: row.internalId,
          externalId: row.externalId,
          syncDirection: "pull" as const,
          syncStatus: "success" as const,
          payloadSnapshot: row.payload,
          lastSyncAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [
          externalSyncMapping.tenantId,
          externalSyncMapping.sourceSystem,
          externalSyncMapping.entityType,
          externalSyncMapping.externalId,
        ],
        set: {
          internalId: sql`excluded.internal_id`,
          payloadSnapshot: sql`excluded.payload_snapshot`,
          syncStatus: "success",
          lastSyncAt: new Date(),
        },
      });
  }

  private async upsertBuerowarePayload(
    targetEntity: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const normalizedTargetEntity = normalizeTargetEntity(targetEntity);
    if (normalizedTargetEntity === "article") {
      const normalized = normalizeArticlePayload(payload);
      const [row] = await db
        .insert(article)
        .values({
          ...normalized,
          tenantId: this.tenantId,
        })
        .onConflictDoUpdate({
          target: [article.tenantId, article.articleNo],
          set: {
            name: normalized.name,
            ...(payload.description !== undefined && {
              description: normalized.description,
            }),
            ...(payload.articleGroupId !== undefined && {
              articleGroupId: normalized.articleGroupId,
            }),
            customAttributes: normalized.customAttributes,
            updatedAt: new Date(),
          },
        })
        .returning({ id: article.articleId });
      await backfillDefaultArticleVariants(this.tenantId);
      return row.id;
    }

    if (normalizedTargetEntity === "address") {
      const normalized = normalizeAddressPayload(payload);

      const [row] = await db
        .insert(address)
        .values({
          ...normalized,
          tenantId: this.tenantId,
          ...(normalized.shopActive !== undefined && { shopActive: normalized.shopActive }),
        })
        .onConflictDoUpdate({
          target: [address.tenantId, address.addressNo],
          set: {
            ...(payload.companyName !== undefined && {
              companyName: normalized.companyName,
            }),
            ...(payload.firstName !== undefined && { firstName: normalized.firstName }),
            ...(payload.lastName !== undefined && { lastName: normalized.lastName }),
            ...(payload.addressLine1 !== undefined && { addressLine1: normalized.addressLine1 }),
            ...(payload.postalCode !== undefined && { postalCode: normalized.postalCode }),
            ...(payload.city !== undefined && { city: normalized.city }),
            ...(payload.countryCode !== undefined && {
              countryCode: normalized.countryCode,
            }),
            ...(payload.salutation !== undefined && { salutation: normalized.salutation }),
            ...(payload.phoneLandline !== undefined && {
              phoneLandline: normalized.phoneLandline,
            }),
            ...(payload.phoneFax !== undefined && { phoneFax: normalized.phoneFax }),
            ...(payload.phoneMobile !== undefined && { phoneMobile: normalized.phoneMobile }),
            ...(payload.email !== undefined && { email: normalized.email }),
            ...(payload.homepage !== undefined && { homepage: normalized.homepage }),
            ...(normalized.commissionRate !== undefined && {
              commissionRate: normalized.commissionRate,
            }),
            ...(payload.creditRatingScore !== undefined && {
              creditRatingScore: normalized.creditRatingScore,
            }),
            ...(normalized.shopActive !== undefined && { shopActive: normalized.shopActive }),
            customAttributes: normalized.customAttributes,
            updatedAt: new Date(),
          },
        })
        .returning({ id: address.addressId });
      return row.id;
    }

    if (normalizedTargetEntity === "article_group") {
      const normalized = normalizeArticleGroupPayload(payload);
      const [row] = await db
        .insert(articleGroup)
        .values({
          ...normalized,
          tenantId: this.tenantId,
        })
        .onConflictDoUpdate({
          target: [articleGroup.tenantId, articleGroup.code],
          set: {
            name: normalized.name,
          },
        })
        .returning({ id: articleGroup.articleGroupId });
      return row.id;
    }

    throw new Error(`Unsupported Büroware target entity: ${targetEntity}`);
  }

  private externalIdForPayload(targetEntity: string, payload: Record<string, unknown>): string {
    const normalizedTargetEntity = normalizeTargetEntity(targetEntity);
    if (normalizedTargetEntity === "article") return toStr(payload.articleNo);
    if (normalizedTargetEntity === "address") return toStr(payload.addressNo);
    if (normalizedTargetEntity === "article_group") return toStr(payload.code);
    throw new Error(`Unsupported Büroware target entity: ${targetEntity}`);
  }

  private async registerExternalMapping(
    targetEntity: string,
    payload: Record<string, unknown>,
    internalId: string,
  ): Promise<void> {
    const entityType = normalizeTargetEntity(targetEntity) as "article" | "article_group" | "address";
    await db
      .insert(externalSyncMapping)
      .values({
        tenantId: this.tenantId,
        salesChannelId: null,
        sourceSystem: "bueroware",
        entityType,
        internalId,
        externalId: this.externalIdForPayload(targetEntity, payload),
        syncDirection: "pull",
        syncStatus: "success",
        payloadSnapshot: payload,
        lastSyncAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          externalSyncMapping.tenantId,
          externalSyncMapping.sourceSystem,
          externalSyncMapping.entityType,
          externalSyncMapping.externalId,
        ],
        set: {
          internalId,
          payloadSnapshot: payload,
          syncStatus: "success",
          lastSyncAt: new Date(),
        },
      });
  }

  async reconcilePendingRows(): Promise<{ posted: number; failed: number; pendingReferences: number }> {
    const pendingRows = await db
      .select()
      .from(importRow)
      .where(and(eq(importRow.tenantId, this.tenantId), eq(importRow.status, "pending_references")));

    const rowsByBatch = new Map<string, Array<typeof importRow.$inferSelect>>();
    for (const row of pendingRows) {
      const rows = rowsByBatch.get(row.batchId) ?? [];
      rows.push(row);
      rowsByBatch.set(row.batchId, rows);
    }

    let posted = 0;
    let failed = 0;
    let pendingReferences = 0;
    for (const [batchId, rows] of rowsByBatch.entries()) {
      const [batch] = await db
        .select()
        .from(importBatch)
        .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)))
        .limit(1);
      const versionId =
        batch?.mappingVersionId ??
        (batch?.layoutId ? await this.resolveMappingVersionForLayout(batch.layoutId) : null);
      if (!versionId) continue;

      const fieldMappings = await db
        .select()
        .from(importFieldMapping)
        .where(eq(importFieldMapping.versionId, versionId));
      const referenceFields = fieldMappings.filter((mapping) => mapping.referenceEntity);
      const referenceLookup = await this.loadReferenceLookup(referenceFields, rows);

      for (const row of rows) {
        const payload = { ...(row.payload as Record<string, unknown>) };
        const missing: Record<string, unknown> = {};
        for (const mapping of referenceFields) {
          const externalKey = toStrOrNull(payload[mapping.targetField])?.trim();
          if (!externalKey || !mapping.referenceEntity) continue;
          const internalId = referenceLookup.get(`${mapping.referenceEntity}:${externalKey}`);
          if (!internalId) {
            missing[mapping.targetField] = externalKey;
          } else {
            payload[mapping.targetField] = internalId;
          }
        }

        if (Object.keys(missing).length === 0) {
          await db
            .update(importRow)
            .set({ status: "valid", payload, missingReferences: null, errorDetail: null })
            .where(eq(importRow.rowId, row.rowId));
        }
      }

      const result = await this.resolveBuerowareBatch(batchId, {
        dryRun: false,
        triggerReconcile: false,
      });
      posted += result.posted;
      failed += result.failed;
      pendingReferences += result.pendingReferences;
    }

    return { posted, failed, pendingReferences };
  }

  async postBatch(batchId: string): Promise<{ posted: number; failed: number }> {
    const [batch] = await db
      .select()
      .from(importBatch)
      .where(and(eq(importBatch.batchId, batchId), eq(importBatch.tenantId, this.tenantId)))
      .limit(1);

    if (!batch) throw new Error("Batch not found");

    if (batch.filePath || batch.status === "validated") {
      if (batch.status !== "approved" && batch.status !== "validated") {
        throw new Error(`Batch cannot be posted in status: ${batch.status}`);
      }
      const result = await this.resolveBuerowareBatch(batchId, { dryRun: false });
      return { posted: result.posted, failed: result.failed };
    }

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
          const baseUnitId = await resolveUnitIdByCode(this.tenantId, payload.baseUnit);
          const salesUnitId = await resolveUnitIdByCode(this.tenantId, payload.salesUnit);
          const purchaseUnitId = await resolveUnitIdByCode(this.tenantId, payload.purchaseUnit);

          await db
            .insert(article)
            .values({
              tenantId: this.tenantId,
              articleNo: toStr(payload.articleNo),
              name: toStr(payload.name),
              description: toStrOrNull(payload.description),
              baseUnitId,
              salesUnitId,
              purchaseUnitId,
            })
            .onConflictDoUpdate({
              target: [article.tenantId, article.articleNo],
              set: {
                ...(payload.name !== undefined && { name: toStr(payload.name) }),
                ...(payload.description !== undefined && {
                  description: toStrOrNull(payload.description),
                }),
                ...(payload.baseUnit !== undefined && { baseUnitId }),
                ...(payload.salesUnit !== undefined && { salesUnitId }),
                ...(payload.purchaseUnit !== undefined && { purchaseUnitId }),
                updatedAt: new Date(),
              },
            });
          await backfillDefaultArticleVariants(this.tenantId);
        } else if (
          row.targetEntity === "articleVariant" ||
          row.targetEntity === "article_variant"
        ) {
          const resolvedArticleId =
            (await resolveArticleIdByNo(this.tenantId, payload.articleNo)) ??
            toStrOrNull(payload.articleId)?.trim() ??
            null;
          if (!resolvedArticleId) {
            throw new Error("articleVariant rows require articleId or articleNo");
          }

          const optionValueHash = toStrOrNull(payload.optionValueHash)?.trim();
          if (!optionValueHash) {
            throw new Error("articleVariant rows require optionValueHash");
          }

          const existingVariant = await resolveVariantIdentity(this.tenantId, {
            ...payload,
            articleId: resolvedArticleId,
          });
          const variantId = existingVariant?.variantId ?? toStrOrNull(payload.variantId)?.trim();
          const payloadSku = toStrOrNull(payload.sku)?.trim();
          const sku = payloadSku || existingVariant?.sku || null;
          if (!sku) {
            throw new Error("articleVariant rows require sku");
          }

          const values = {
            tenantId: this.tenantId,
            ...(variantId ? { variantId } : {}),
            articleId: resolvedArticleId,
            sku,
            ean: toStrOrNull(payload.ean),
            optionValueHash,
            price: toStrOrNull(payload.price),
            weight: toStrOrNull(payload.weight),
            isActive:
              payload.isActive === undefined ? true : (toBoolOrNull(payload.isActive) ?? true),
          };

          const conflictTarget = variantId
            ? [articleVariant.variantId]
            : [articleVariant.tenantId, articleVariant.articleId, articleVariant.optionValueHash];

          await db
            .insert(articleVariant)
            .values(values)
            .onConflictDoUpdate({
              target: conflictTarget as any,
              set: {
                articleId: resolvedArticleId,
                sku: values.sku,
                ...(payload.ean !== undefined && { ean: values.ean }),
                optionValueHash,
                ...(payload.price !== undefined && { price: values.price }),
                ...(payload.weight !== undefined && { weight: values.weight }),
                ...(payload.isActive !== undefined && { isActive: values.isActive }),
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
                ...(payload.firstName !== undefined && {
                  firstName: toStrOrNull(payload.firstName),
                }),
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
