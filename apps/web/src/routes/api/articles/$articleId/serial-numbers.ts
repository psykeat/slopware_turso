import { auth } from "@repo/auth/auth";
import { db, runInTenantScope } from "@repo/db";
import { serialNumber } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, asc } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/articles/$articleId/serial-numbers")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const url = new URL(request.url);
        const status = url.searchParams.get("status");

        return runInTenantScope(context, async () => {
          const conditions = [eq(serialNumber.articleId, params.articleId)];

          if (status) {
            conditions.push(eq(serialNumber.status, status));
          }

          const rows = await db
            .select({
              serialNumberId: serialNumber.serialNumberId,
              serialNo: serialNumber.serialNo,
              status: serialNumber.status,
              createdAt: serialNumber.createdAt,
            })
            .from(serialNumber)
            .where(and(...conditions))
            .orderBy(asc(serialNumber.serialNo));

          return new Response(JSON.stringify(rows), {
            headers: { "content-type": "application/json" },
          });
        });
      },
    },
  },
});
