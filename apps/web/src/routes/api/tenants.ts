import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { getAllTenants } from "@repo/db/services/tenant";

export const Route = createFileRoute("/api/tenants")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) return new Response("Unauthorized", { status: 401 });
        if (!(session.user as any).isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const tenants = await getAllTenants();
        return new Response(JSON.stringify(tenants), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
