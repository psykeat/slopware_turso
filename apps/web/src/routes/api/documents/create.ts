import { auth } from "@repo/auth/auth";
import { DocumentService, DIRECTION_FROM_TYPE } from "@repo/db/services/document-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/documents/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const body = await request.json();

        const documentType = body.documentType as string;
        if (!documentType) return new Response("documentType required", { status: 400 });
        if (!body.documentGroupId) return new Response("documentGroupId required", { status: 400 });
        if (!body.documentDate) return new Response("documentDate required", { status: 400 });

        try {
          const svc = new DocumentService();
          const result = await svc.saveDocumentDraft(context.tenantId, session.user.id, {
            documentId: body.documentId ?? null,
            documentGroupId: body.documentGroupId,
            documentType,
            documentDirection:
              body.documentDirection ?? DIRECTION_FROM_TYPE[documentType] ?? "OUTBOUND",
            documentDate: body.documentDate,
            customerId: body.customerId ?? null,
            billingAddress: body.billingAddress ?? null,
            deliveryAddress: body.deliveryAddress ?? null,
            deliveryAddressId: body.deliveryAddressId ?? null,
            customAttributes: body.customAttributes ?? null,
            currencyId: body.currencyId ?? null,
            warehouseId: body.warehouseId ?? null,
            paymentTermId: body.paymentTermId ?? null,
            shippingMethodId: body.shippingMethodId ?? null,
            lines: Array.isArray(body.lines) ? body.lines : [],
          });

          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          console.error("[documents/create]", err);
          return new Response(err.message ?? "Internal error", { status: 500 });
        }
      },
    },
  },
});
