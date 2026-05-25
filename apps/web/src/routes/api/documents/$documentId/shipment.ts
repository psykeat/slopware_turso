import { auth } from "@repo/auth/auth";
import { LogisticsService } from "@repo/db/services/logistics-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/documents/$documentId/shipment")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          const svc = new LogisticsService();
          const result = await svc.getOrCreateShipment(context.tenantId, params.documentId);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          });
        } catch (error: any) {
          console.error("Failed to get or create shipment:", error);
          const message = error?.message || "Failed to process";
          const status = message.includes("Document not found")
            ? 404
            : message.includes("Shipment address incomplete")
              ? 400
              : 500;
          return new Response(message, { status });
        }
      },
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          const body = await request.json();
          const svc = new LogisticsService();

          let shipment = null;
          let packages = null;

          if (body.shipment) {
            shipment = await svc.updateShipment(context.tenantId, params.documentId, body.shipment);
          }

          if (body.packages && Array.isArray(body.packages)) {
            // Find the shipment ID (either existing or new)
            const shDetails = await svc.getOrCreateShipment(context.tenantId, params.documentId);
            const shipmentId = shDetails?.shipment?.documentShipmentId;
            if (shipmentId) {
              await svc.savePackages(context.tenantId, shipmentId, body.packages);
            }

            const refreshed = await svc.getShipmentWithPackages(
              context.tenantId,
              params.documentId,
            );
            if (refreshed) {
              shipment = refreshed.shipment;
              packages = refreshed.packages;
            }
          } else {
            const refreshed = await svc.getShipmentWithPackages(
              context.tenantId,
              params.documentId,
            );
            if (refreshed) {
              shipment = refreshed.shipment;
              packages = refreshed.packages;
            }
          }

          return new Response(
            JSON.stringify({
              shipment,
              packages,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        } catch (error: any) {
          console.error("Failed to update shipment / packages:", error);
          const message = error?.message || "Failed to process";
          const status = message.includes("Document not found")
            ? 404
            : message.includes("Shipment address incomplete")
              ? 400
              : 500;
          return new Response(message, { status });
        }
      },
    },
  },
});
