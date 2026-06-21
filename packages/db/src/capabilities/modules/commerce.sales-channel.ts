import { z } from "zod";

import { db, eq } from "../../index";
import { salesChannel } from "../../schema/sqlite.schema";
import { decryptSecret, encryptSecret } from "../../services/secret-crypto";
import { defineCapability } from "../core/define";
import { listControlsSchema, runEntityList, type ListControls } from "../core/list";
import { CapabilityError } from "../core/types";

const platformSchema = z.enum(["shopware6", "shopify", "woocommerce", "prestashop"]);

const credentialsInputSchema = z
  .object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    // App-System secret used to verify inbound webhook signatures (optional).
    appSecret: z.string().min(1).optional(),
  })
  .nullable()
  .optional();

const salesChannelRecordSchema = z.object({
  salesChannelId: z.uuid(),
  name: z.string(),
  platform: platformSchema,
  apiUrl: z.string(),
  credentials: z.unknown().nullable(),
  masterDataPolicy: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

// The `clientSecret`/`appSecret` are encrypted at rest (AES-256-GCM via
// secret-crypto). `clientId` stays in clear so it remains readable in list/edit
// views.
function encryptCredentials(
  credentials: { clientId: string; clientSecret: string; appSecret?: string } | null | undefined,
): { clientId: string; clientSecret: string; appSecret?: string } | null {
  if (!credentials) return null;
  return {
    clientId: credentials.clientId,
    clientSecret: encryptSecret(credentials.clientSecret),
    ...(credentials.appSecret ? { appSecret: encryptSecret(credentials.appSecret) } : {}),
  };
}

// Decrypt the stored secrets back to plaintext for the (authenticated) caller.
// Tolerates any other credential shape (e.g. legacy/mock data) untouched.
function decryptCredentials(credentials: unknown): unknown {
  if (!credentials || typeof credentials !== "object") return credentials ?? null;
  const record = credentials as Record<string, unknown>;
  if (typeof record.clientSecret !== "string") return credentials;
  const next: Record<string, unknown> = {
    ...record,
    clientSecret: decryptSecret(record.clientSecret),
  };
  if (typeof record.appSecret === "string") next.appSecret = decryptSecret(record.appSecret);
  return next;
}

function withDecryptedCredentials<T extends { credentials: unknown }>(row: T): T {
  return { ...row, credentials: decryptCredentials(row.credentials) };
}

export const salesChannelList = defineCapability({
  module: "commerce",
  entityName: "salesChannel",
  operation: "list",
  kind: "read",
  summary: { en: "List sales channels", de: "Verkaufskanäle auflisten" },
  input: z.object({
    platform: platformSchema.optional(),
    ...listControlsSchema,
    limit: z.number().int().min(1).max(200).default(50),
  }),
  output: z.object({
    items: z.array(salesChannelRecordSchema),
    total: z.number().int().optional(),
  }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (ctx, input) => {
    const filters: Record<string, string> = {};
    if (input.platform) filters.platform = input.platform;
    const { items, total } = await runEntityList(
      "salesChannel",
      filters,
      input as ListControls,
      "name:asc",
    );
    return {
      items: (items as Array<z.infer<typeof salesChannelRecordSchema>>).map(
        withDecryptedCredentials,
      ),
      total,
    };
  },
});

export const salesChannelGet = defineCapability({
  module: "commerce",
  entityName: "salesChannel",
  operation: "get",
  kind: "read",
  summary: { en: "Get a sales channel by ID", de: "Verkaufskanal per ID lesen" },
  input: z.object({ salesChannelId: z.uuid() }),
  output: salesChannelRecordSchema,
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "safe", http: true },
  schemaVersion: 1,
  handler: async (_ctx, input) => {
    const [row] = await db
      .select()
      .from(salesChannel)
      .where(eq(salesChannel.salesChannelId, input.salesChannelId))
      .limit(1);
    if (!row) throw new CapabilityError("not_found", "Sales channel not found");
    return withDecryptedCredentials(row);
  },
});

export const salesChannelCreate = defineCapability({
  module: "commerce",
  entityName: "salesChannel",
  operation: "create",
  kind: "create",
  summary: { en: "Create a sales channel", de: "Verkaufskanal anlegen" },
  input: z.object({
    name: z.string().trim().min(1).max(200),
    platform: platformSchema,
    apiUrl: z.url().max(500),
    credentials: credentialsInputSchema,
    masterDataPolicy: z.string().max(50).nullable().optional(),
  }),
  output: salesChannelRecordSchema,
  writesTables: ["salesChannel"],
  sideEffects: [],
  idempotent: false,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (_ctx, input) => {
    const [created] = await db
      .insert(salesChannel)
      .values({
        name: input.name,
        platform: input.platform,
        apiUrl: input.apiUrl,
        credentials: encryptCredentials(input.credentials),
        masterDataPolicy: input.masterDataPolicy ?? null,
      })
      .returning();
    return withDecryptedCredentials(created);
  },
});

export const salesChannelUpdate = defineCapability({
  module: "commerce",
  entityName: "salesChannel",
  operation: "update",
  kind: "update",
  summary: { en: "Update a sales channel", de: "Verkaufskanal aktualisieren" },
  input: z.object({
    salesChannelId: z.uuid(),
    patch: z.object({
      name: z.string().trim().min(1).max(200).optional(),
      platform: platformSchema.optional(),
      apiUrl: z.url().max(500).optional(),
      credentials: credentialsInputSchema,
      masterDataPolicy: z.string().max(50).nullable().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  output: salesChannelRecordSchema,
  writesTables: ["salesChannel"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (_ctx, input) => {
    const { credentials, ...rest } = input.patch;
    // Only touch the credentials column when the patch carries the field, so
    // editing other attributes never wipes the stored (encrypted) secret.
    const patch: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if ("credentials" in input.patch) patch.credentials = encryptCredentials(credentials);

    const [updated] = await db
      .update(salesChannel)
      .set(patch)
      .where(eq(salesChannel.salesChannelId, input.salesChannelId))
      .returning();
    if (!updated) throw new CapabilityError("not_found", "Sales channel not found");
    return withDecryptedCredentials(updated);
  },
});

export const salesChannelArchive = defineCapability({
  module: "commerce",
  entityName: "salesChannel",
  operation: "archive",
  kind: "archive",
  summary: { en: "Deactivate a sales channel", de: "Verkaufskanal deaktivieren" },
  input: z.object({ salesChannelId: z.uuid() }),
  output: z.object({ salesChannelId: z.uuid(), isActive: z.literal(false) }),
  writesTables: ["salesChannel"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (_ctx, input) => {
    const [updated] = await db
      .update(salesChannel)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(salesChannel.salesChannelId, input.salesChannelId))
      .returning();
    if (!updated) throw new CapabilityError("not_found", "Sales channel not found");
    return { salesChannelId: input.salesChannelId, isActive: false as const };
  },
});

export const salesChannelTestConnection = defineCapability({
  module: "commerce",
  entityName: "salesChannel",
  operation: "testConnection",
  // No tenant tables are written — it is an idempotent external probe, so it
  // belongs in the read bucket (the writesTables guard rejects non-read caps
  // with no writesTables). The external HTTP call is declared via sideEffects.
  kind: "read",
  summary: {
    en: "Test the connection to a sales channel",
    de: "Verbindung zum Verkaufskanal testen",
  },
  description: {
    en: "Attempts an OAuth2 token fetch against the configured API URL to verify credentials.",
    de: "Versucht einen OAuth2-Token-Abruf gegen die konfigurierte API-URL, um die Zugangsdaten zu prüfen.",
  },
  input: z.object({
    apiUrl: z.url(),
    credentials: z.object({ clientId: z.string().min(1), clientSecret: z.string().min(1) }),
  }),
  output: z.object({ success: z.boolean(), message: z.string() }),
  writesTables: [],
  sideEffects: ["performs an HTTP request to the configured shop API"],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "confirm", http: true },
  schemaVersion: 1,
  handler: async (_ctx, input) => {
    try {
      const response = await fetch(`${input.apiUrl.replace(/\/$/, "")}/api/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: input.credentials.clientId,
          client_secret: input.credentials.clientSecret,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          message: `OAuth failed (${response.status}): ${body.slice(0, 200)}`,
        };
      }
      const data = (await response.json()) as { access_token?: unknown };
      if (typeof data.access_token !== "string") {
        return { success: false, message: "Response did not include access_token" };
      }
      return { success: true, message: "Connection successful" };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
});

export const salesChannelCapabilities = [
  salesChannelList,
  salesChannelGet,
  salesChannelCreate,
  salesChannelUpdate,
  salesChannelArchive,
  salesChannelTestConnection,
];
