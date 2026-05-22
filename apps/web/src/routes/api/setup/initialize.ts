import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { company } from "@repo/db/schema";
import { initializeCompanyData } from "@repo/db/services/company-initializer";
import { getUserTenantInfo, getTenantInfoById } from "@repo/db/services/tenant";
import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const Route = createFileRoute("/api/setup/initialize")({
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
        let body: { companyId?: string; countryCode?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response("Invalid JSON payload", { status: 400 });
        }

        const { companyId, countryCode } = body;
        if (!companyId || !countryCode || (countryCode !== "DE" && countryCode !== "AT")) {
          return new Response("Missing or invalid companyId or countryCode (must be DE or AT)", {
            status: 400,
          });
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

        // 5. Initialize company data
        try {
          await initializeCompanyData(tenantId, companyId, countryCode);
          return new Response(
            JSON.stringify({ success: true, message: "Company data initialized successfully" }),
            {
              headers: { "content-type": "application/json" },
            },
          );
        } catch (error: any) {
          console.error("Failed to initialize company data:", error);
          return new Response(
            JSON.stringify({ success: false, error: error.message || "Initialization failed" }),
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
