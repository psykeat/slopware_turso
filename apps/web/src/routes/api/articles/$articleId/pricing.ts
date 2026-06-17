import { auth } from "@repo/auth/auth";
import { DocumentService } from "@repo/db/services/document-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/articles/$articleId/pricing")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        const url = new URL(request.url);
        const customerId = url.searchParams.get("customerId") ?? null;
        const documentDate =
          url.searchParams.get("documentDate") ?? new Date().toISOString().slice(0, 10);
        const deliveryAddressId = url.searchParams.get("deliveryAddressId") ?? null;
        const deliveryCountryCode = url.searchParams.get("deliveryCountryCode") ?? null;
        const billingCountryCode = url.searchParams.get("billingCountryCode") ?? null;

        try {
          const svc = new DocumentService();
          const result = await svc.resolveVariantPricing(
            params.articleId,
            customerId,
            documentDate,
            context.tenantId,
            {
              deliveryAddressId,
              deliveryCountryCode,
              billingCountryCode,
            },
          );
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 400 });
        }
      },
    },
  },
});
