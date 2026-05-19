import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { documentLine, documentLineTracking } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute(
  "/api/documents/$documentId/lines/$lineId/tracking/$trackingId",
)({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        // Verify documentLine belongs to this tenant and document
        const lineRows = await db
          .select({ documentLineId: documentLine.documentLineId })
          .from(documentLine)
          .where(
            and(
              eq(documentLine.tenantId, context.tenantId),
              eq(documentLine.documentId, params.documentId),
              eq(documentLine.documentLineId, params.lineId),
            ),
          )
          .limit(1);

        if (lineRows.length === 0) {
          return new Response("Document line not found", { status: 404 });
        }

        const deleted = await db
          .delete(documentLineTracking)
          .where(
            and(
              eq(documentLineTracking.tenantId, context.tenantId),
              eq(documentLineTracking.documentLineId, params.lineId),
              eq(documentLineTracking.trackingId, params.trackingId),
            ),
          )
          .returning({ trackingId: documentLineTracking.trackingId });

        if (deleted.length === 0) {
          return new Response("Tracking entry not found", { status: 404 });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
