import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { systemSettings } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Encryption helpers (AES-256-GCM)
// ENCRYPTION_SECRET must be a 32-byte value hex-encoded (64 hex chars).
// If the env var is missing we fall back to plaintext (dev convenience).
// ---------------------------------------------------------------------------

const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_SECRET ?? "";
const ENCRYPTION_KEY =
  ENCRYPTION_KEY_HEX.length === 64 ? Buffer.from(ENCRYPTION_KEY_HEX, "hex") : null;

if (!ENCRYPTION_KEY) {
  console.warn(
    "[llm-config] ENCRYPTION_SECRET is missing or invalid — secrets will be stored as plaintext.",
  );
}

function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) return text;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(encoded: string): string {
  if (!ENCRYPTION_KEY) return encoded;
  // If it doesn't look like an encrypted value, return as-is (plaintext fallback)
  const parts = encoded.split(":");
  if (parts.length !== 3) return encoded;
  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

const SENTINEL = "••••••••";

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/api/admin/llm-config")({
  server: {
    handlers: {
      // ------------------------------------------------------------------
      // GET — return current config with secrets masked
      // ------------------------------------------------------------------
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as Record<string, unknown>).isSystemAdmin;
        if (!isSystemAdmin) {
          return new Response("Forbidden", { status: 403 });
        }

        const existing = await db
          .select()
          .from(systemSettings)
          .where(and(eq(systemSettings.scope, "global"), eq(systemSettings.key, "llm_config")))
          .limit(1);

        if (!existing[0]) {
          return new Response(JSON.stringify({ configured: false }), {
            headers: { "content-type": "application/json" },
          });
        }

        const stored = existing[0].value as {
          endpointUrl?: string;
          model?: string;
          apiKey?: string;
          githubToken?: string;
          githubRepo?: string;
        };

        return new Response(
          JSON.stringify({
            configured: true,
            endpointUrl: stored.endpointUrl ?? "",
            model: stored.model ?? "",
            apiKey: stored.apiKey ? SENTINEL : "",
            githubToken: stored.githubToken ? SENTINEL : "",
            githubRepo: stored.githubRepo ?? "",
          }),
          { headers: { "content-type": "application/json" } },
        );
      },

      // ------------------------------------------------------------------
      // POST — upsert config, encrypting secrets
      // ------------------------------------------------------------------
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as Record<string, unknown>).isSystemAdmin;
        if (!isSystemAdmin) {
          return new Response("Forbidden", { status: 403 });
        }

        const body = (await request.json()) as {
          endpointUrl: string;
          model: string;
          apiKey: string;
          githubToken: string;
          githubRepo: string;
        };

        // Read existing row so we can preserve encrypted secrets when the
        // client sends back the sentinel value ("unchanged").
        const existing = await db
          .select()
          .from(systemSettings)
          .where(and(eq(systemSettings.scope, "global"), eq(systemSettings.key, "llm_config")))
          .limit(1);

        const existingValue = (existing[0]?.value ?? {}) as {
          apiKey?: string;
          githubToken?: string;
        };

        // Resolve encrypted values: if the incoming value is the sentinel,
        // keep the already-stored (encrypted) value unchanged.
        const resolvedApiKey =
          body.apiKey === SENTINEL ? (existingValue.apiKey ?? "") : encrypt(body.apiKey);

        const resolvedGithubToken =
          body.githubToken === SENTINEL
            ? (existingValue.githubToken ?? "")
            : encrypt(body.githubToken);

        const newValue = {
          endpointUrl: body.endpointUrl,
          model: body.model,
          apiKey: resolvedApiKey,
          githubToken: resolvedGithubToken,
          githubRepo: body.githubRepo,
        };

        if (existing[0]) {
          await db
            .update(systemSettings)
            .set({ value: newValue, updatedAt: new Date() })
            .where(eq(systemSettings.settingId, existing[0].settingId));
        } else {
          await db.insert(systemSettings).values({
            scope: "global",
            key: "llm_config",
            value: newValue,
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
