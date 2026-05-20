import { auth } from "@repo/auth/auth";
import { MetadataResolver } from "@repo/db/services/metadata";
import { MetadataWriter } from "@repo/db/services/metadata-writer";
import { getTenantInfoById } from "@repo/db/services/tenant";
import { createFileRoute } from "@tanstack/react-router";

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
          console.warn(
            `[Metadata API] No tenant context for user ${session.user.id}, falling back to global.`,
          );
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
            console.log(
              `[Metadata API] Resolving layout for entity: ${entityName}, key: ${layoutKey}`,
            );
            if (!entityName || !layoutKey) return new Response("Bad Request", { status: 400 });
            const layout = await resolver.getEffectiveLayout(entityName, layoutKey);
            return new Response(JSON.stringify(layout), {
              headers: { "content-type": "application/json" },
            });
          }

          return new Response("Not Found", { status: 404 });
        } catch (err) {
          console.error("API Metadata Error:", err);
          return new Response(err instanceof Error ? err.message : "Internal Server Error", {
            status: 500,
          });
        }
      },
      POST: async ({ request }) => {
        return handleUpdate({ request });
      },
      PATCH: async ({ request }) => {
        return handleUpdate({ request });
      },
    },
  },
});

async function handleUpdate({ request }: { request: Request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const isSystemAdmin = (session.user as any).isSystemAdmin;
  const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
  if (!context) {
    return new Response("Tenant context required for updates", { status: 400 });
  }

  const tenantInfo = await getTenantInfoById(context.tenantId);
  const writer = new MetadataWriter({
    tenantId: context.tenantId,
    userId: session.user.id,
    isSystemAdmin,
    isBaseTenant: tenantInfo?.isBase ?? false,
    organizationId: context.organizationId,
  });

  const url = new URL(request.url, "http://localhost");
  const pathname = url.pathname;
  const body = await request.json();

  try {
    if (pathname.includes("/fields/")) {
      const segments = pathname.split("/").filter(Boolean);
      const entityName = segments.pop();
      if (!entityName) return new Response("Bad Request", { status: 400 });

      // Expects { fieldName: string, data: any }
      const { fieldName, data } = body;
      if (!fieldName || !data) return new Response("Missing fieldName or data", { status: 400 });

      await writer.saveFieldOverride(entityName, fieldName, data);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (pathname.includes("/layout/")) {
      const segments = pathname.split("/").filter(Boolean);
      const layoutKey = segments.pop();
      const entityName = segments.pop();
      if (!entityName || !layoutKey) return new Response("Bad Request", { status: 400 });

      // Expects the layout definition directly as body
      await writer.saveLayoutOverride(entityName, layoutKey, body);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (pathname.includes("/groups/")) {
      const segments = pathname.split("/").filter(Boolean);
      const entityName = segments.pop();
      if (!entityName) return new Response("Bad Request", { status: 400 });

      // Expects { groupKey: string, data: any }
      const { groupKey, data } = body;
      if (!groupKey || !data) return new Response("Missing groupKey or data", { status: 400 });

      await writer.saveGroupOverride(entityName, groupKey, data);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  } catch (err) {
    console.error("API Metadata Update Error:", err);
    return new Response(err instanceof Error ? err.message : "Internal Server Error", {
      status: 500,
    });
  }
}
