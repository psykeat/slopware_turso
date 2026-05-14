import { createFileRoute } from "@tanstack/react-router";
import { DataService } from "@repo/db/services/data";
import { getTenantContext } from "@repo/db/services/tenant";
import { auth } from "@repo/auth/auth";

export const Route = createFileRoute("/api/data/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const context = await getTenantContext(session.user.id);
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        const service = new DataService(context.tenantId);
        const url = new URL(request.url);
        const pathname = url.pathname;
        const entityName = pathname.split("/").pop();

        if (!entityName) return new Response("Bad Request", { status: 400 });

        try {
          const data = await service.list(entityName);
          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 404 });
        }
      },
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) return new Response("Unauthorized", { status: 401 });

        const context = await getTenantContext(session.user.id);
        if (!context) return new Response("Forbidden", { status: 403 });

        const service = new DataService(context.tenantId);
        const entityName = new URL(request.url).pathname.split("/").pop();
        if (!entityName) return new Response("Bad Request", { status: 400 });

        const body = await request.json();
        const result = await service.create(entityName, body);
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json" },
        });
      },
      PATCH: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) return new Response("Unauthorized", { status: 401 });

        const context = await getTenantContext(session.user.id);
        if (!context) return new Response("Forbidden", { status: 403 });

        const service = new DataService(context.tenantId);
        const segments = new URL(request.url).pathname.split("/");
        const id = segments.pop();
        const entityName = segments.pop();

        if (!entityName || !id) return new Response("Bad Request", { status: 400 });

        const body = await request.json();
        const result = await service.patch(entityName, id, body);
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
