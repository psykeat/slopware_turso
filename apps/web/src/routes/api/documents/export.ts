import { auth } from "@repo/auth/auth";
import { LogisticsService } from "@repo/db/services/logistics-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/documents/export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          const body = await request.json();
          const documentIds = body.documentIds as string[];

          if (!documentIds || !Array.isArray(documentIds)) {
            return new Response("documentIds array is required", { status: 400 });
          }

          const svc = new LogisticsService();
          const csvContent = await svc.exportShipmentsCSV(context.tenantId, documentIds);

          return new Response(csvContent, {
            status: 200,
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": 'attachment; filename="dhl_export.csv"',
            },
          });
        } catch (error: any) {
          console.error("Failed to export shipments CSV:", error);
          const message = error?.message || "Failed to export";
          const status = message.includes("Document not found")
            ? 404
            : message.includes("Shipment address incomplete") || message.includes("has no packages")
              ? 400
              : 500;
          return new Response(message, { status });
        }
      },
    },
  },
});
