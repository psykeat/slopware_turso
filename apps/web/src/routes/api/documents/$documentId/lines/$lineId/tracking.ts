import { createFileRoute } from "@tanstack/react-router";
import { db } from "@repo/db";
import { documentLine, documentLineTracking } from "@repo/db/schema";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { and, eq } from "drizzle-orm";

async function resolveDocumentLine(tenantId: string, documentId: string, lineId: string) {
  const rows = await db
    .select({ documentLineId: documentLine.documentLineId })
    .from(documentLine)
    .where(
      and(
        eq(documentLine.tenantId, tenantId),
        eq(documentLine.documentId, documentId),
        eq(documentLine.documentLineId, lineId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export const Route = createFileRoute(
  "/api/documents/$documentId/lines/$lineId/tracking",
)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const line = await resolveDocumentLine(
          context.tenantId,
          params.documentId,
          params.lineId,
        );
        if (!line) return new Response("Document line not found", { status: 404 });

        const rows = await db
          .select({
            trackingId: documentLineTracking.trackingId,
            serialNumberId: documentLineTracking.serialNumberId,
            serialNo: documentLineTracking.serialNo,
            batchNo: documentLineTracking.batchNo,
            qty: documentLineTracking.qty,
            createdAt: documentLineTracking.createdAt,
          })
          .from(documentLineTracking)
          .where(
            and(
              eq(documentLineTracking.tenantId, context.tenantId),
              eq(documentLineTracking.documentLineId, params.lineId),
            ),
          );

        return new Response(JSON.stringify(rows), {
          headers: { "content-type": "application/json" },
        });
      },

      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const line = await resolveDocumentLine(
          context.tenantId,
          params.documentId,
          params.lineId,
        );
        if (!line) return new Response("Document line not found", { status: 404 });

        let body: { serialNumberId?: string; serialNo?: string; batchNo?: string; qty: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }

        if (!body.qty) {
          return new Response("qty is required", { status: 400 });
        }

        const hasSerial = Boolean(body.serialNumberId);
        const hasSerialNo = Boolean(body.serialNo?.trim());
        const hasBatch = Boolean(body.batchNo);

        if (Number(hasSerial) + Number(hasSerialNo) + Number(hasBatch) !== 1) {
          return new Response(
            "Exactly one of serialNumberId, serialNo or batchNo must be provided",
            { status: 400 },
          );
        }

        const [inserted] = await db
          .insert(documentLineTracking)
          .values({
            tenantId: context.tenantId,
            documentLineId: params.lineId,
            serialNumberId: body.serialNumberId ?? null,
            serialNo: body.serialNo?.trim() ?? null,
            batchNo: body.batchNo ?? null,
            qty: body.qty,
          })
          .returning();

        return new Response(JSON.stringify(inserted), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
