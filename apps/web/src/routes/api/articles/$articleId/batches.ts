import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { inventoryMovement } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/articles/$articleId/batches")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const url = new URL(request.url);
        const warehouseId = url.searchParams.get("warehouseId");

        const conditions = [
          eq(inventoryMovement.tenantId, context.tenantId),
          eq(inventoryMovement.articleId, params.articleId),
          isNotNull(inventoryMovement.batchNo),
        ];

        if (warehouseId) {
          conditions.push(eq(inventoryMovement.warehouseId, warehouseId));
        }

        const rows = await db
          .select({
            batchNo: inventoryMovement.batchNo,
            warehouseId: inventoryMovement.warehouseId,
            balance: sql<string>`SUM(${inventoryMovement.qtyDelta})`,
          })
          .from(inventoryMovement)
          .where(and(...conditions))
          .groupBy(inventoryMovement.batchNo, inventoryMovement.warehouseId)
          .having(sql`SUM(${inventoryMovement.qtyDelta}) > 0`);

        return new Response(JSON.stringify(rows), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
