import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { company, numberSequence } from "@repo/db/schema";
import { getUserTenantInfo, getTenantInfoById } from "@repo/db/services/tenant";
import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const Route = createFileRoute("/api/setup/year-end")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Authenticate user
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        // 2. Fetch tenant context (strict server-side check)
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        let tenantInfo = null;

        if (isSystemAdmin) {
          const activeTenantId = parseCookie(request.headers.get("cookie"), "x-active-tenant");
          if (activeTenantId) {
            tenantInfo = await getTenantInfoById(activeTenantId);
          }
        }

        if (!tenantInfo) {
          tenantInfo = await getUserTenantInfo(session.user.id);
        }

        if (!tenantInfo || !tenantInfo.tenantId) {
          return new Response("No active tenant found", { status: 403 });
        }

        const tenantId = tenantInfo.tenantId;

        // 3. Parse and validate body
        let body: { companyId?: string; fiscalYear?: number } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Invalid JSON payload", { status: 400 });
        }

        const { companyId, fiscalYear } = body;
        if (!companyId || !fiscalYear || typeof fiscalYear !== "number") {
          return new Response("Missing or invalid companyId or fiscalYear", { status: 400 });
        }

        // 4. Verify company belongs to the tenant
        const [comp] = await db
          .select()
          .from(company)
          .where(and(eq(company.companyId, companyId), eq(company.tenantId, tenantId)))
          .limit(1);

        if (!comp) {
          return new Response("Company not found or access denied", { status: 404 });
        }

        // 5. Carry out year rollover in a transaction
        try {
          await db.transaction(async (tx) => {
            // Find existing sequences for this company
            const existingSeqs = await tx
              .select()
              .from(numberSequence)
              .where(
                and(eq(numberSequence.tenantId, tenantId), eq(numberSequence.companyId, companyId)),
              );

            // Group by prefix to get the latest settings per prefix
            const latestSeqsByPrefix = new Map<string, typeof numberSequence.$inferSelect>();
            for (const seq of existingSeqs) {
              const current = latestSeqsByPrefix.get(seq.prefix);
              if (!current || (seq.fiscalYear || 0) > (current.fiscalYear || 0)) {
                latestSeqsByPrefix.set(seq.prefix, seq);
              }
            }

            // Insert new sequences for the target year
            for (const [prefix, seq] of latestSeqsByPrefix.entries()) {
              await tx
                .insert(numberSequence)
                .values({
                  tenantId,
                  companyId,
                  prefix,
                  fiscalYear,
                  nextValue: 1,
                  padding: seq.padding ?? 6,
                  archived: false,
                })
                .onConflictDoNothing(); // If it already exists, do nothing
            }
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: `Number sequences rolled over to fiscal year ${fiscalYear} successfully`,
            }),
            {
              headers: { "content-type": "application/json" },
            },
          );
        } catch (error: any) {
          console.error("Failed to roll over fiscal year:", error);
          return new Response(
            JSON.stringify({ success: false, error: error.message || "Rollover failed" }),
            {
              status: 500,
              headers: { "content-type": "application/json" },
            },
          );
        }
      },
    },
  },
});
