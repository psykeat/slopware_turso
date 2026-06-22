import { auth } from "@repo/auth/auth";
import { db, runInTenantScope } from "@repo/db";
import { company, user } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/me/company")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const body = await request.json().catch(() => ({}));
        const companyId = typeof body.companyId === "string" ? body.companyId : null;
        if (!companyId) return new Response("companyId is required", { status: 400 });

        return runInTenantScope(context, async () => {
          const [row] = await db
            .select({ companyId: company.companyId })
            .from(company)
            .where(eq(company.companyId, companyId))
            .limit(1);

          if (!row) return new Response("Company not found in active tenant", { status: 404 });

          const [updated] = await db
            .update(user)
            .set({ lastCompanyId: companyId })
            .where(eq(user.id, session.user.id))
            .returning({ lastCompanyId: user.lastCompanyId });

          return new Response(JSON.stringify(updated), {
            headers: { "content-type": "application/json" },
          });
        });
      },
    },
  },
});
