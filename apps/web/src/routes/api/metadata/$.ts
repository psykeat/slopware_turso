import { createFileRoute } from "@tanstack/react-router";
import { MetadataResolver } from "@repo/db/services/metadata";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/metadata/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Authenticate request and extract tenant context
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        let context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) {
          console.warn(`[Metadata API] No tenant context for user ${session.user.id}, falling back to global.`);
          context = { tenantId: "", organizationId: "" }; // Empty context for global resolution
        }

        const resolver = new MetadataResolver(context);
        const url = new URL(request.url, "http://localhost");
        const pathname = url.pathname;
        console.log(`[Metadata API] Request: ${request.method} ${pathname}`);

        try {
          if (pathname.includes("/settings-registry")) {
            console.log(`[Metadata API] Resolving settings registry`);
            const registry = await resolver.getSettingsRegistry();
            return new Response(JSON.stringify(registry), {
              headers: { "content-type": "application/json" },
            });
          }

          if (pathname.includes("/fields/")) {
            const segments = pathname.split("/").filter(Boolean);
            const entityName = segments.pop();
            console.log(`[Metadata API] Resolving fields for entity: ${entityName}`);
            if (!entityName) return new Response("Bad Request", { status: 400 });
            const fields = await resolver.getEffectiveFields(entityName);
            return new Response(JSON.stringify(fields), {
              headers: { "content-type": "application/json" },
            });
          }

          if (pathname.includes("/layout/")) {
            const segments = pathname.split("/").filter(Boolean);
            const layoutKey = segments.pop();
            const entityName = segments.pop();
            console.log(`[Metadata API] Resolving layout for entity: ${entityName}, key: ${layoutKey}`);
            if (!entityName || !layoutKey) return new Response("Bad Request", { status: 400 });
            const layout = await resolver.getEffectiveLayout(entityName, layoutKey);
            return new Response(JSON.stringify(layout), {
              headers: { "content-type": "application/json" },
            });
          }

          return new Response("Not Found", { status: 404 });
        } catch (err) {
          console.error("API Metadata Error:", err);
          return new Response(err instanceof Error ? err.message : "Internal Server Error", { status: 500 });
        }
      },
    },
  },
});
