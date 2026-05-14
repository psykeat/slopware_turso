import { createFileRoute } from "@tanstack/react-router";
import { MetadataResolver } from "@repo/db/services/metadata";
import { getTenantContext } from "@repo/db/services/tenant";
import { auth } from "@repo/auth/auth";

export const Route = createFileRoute("/api/metadata/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Authenticate request and extract tenant context
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const context = await getTenantContext(session.user.id);
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        const resolver = new MetadataResolver(context);
        const url = new URL(request.url);
        const pathname = url.pathname;

        try {
          if (pathname.includes("/fields/")) {
            const entityName = pathname.split("/").pop();
            if (!entityName) return new Response("Bad Request", { status: 400 });
            const fields = await resolver.getEffectiveFields(entityName);
            return new Response(JSON.stringify(fields), {
              headers: { "content-type": "application/json" },
            });
          }

          if (pathname.includes("/layout/")) {
            const segments = pathname.split("/");
            const layoutKey = segments.pop();
            const entityName = segments.pop();
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
