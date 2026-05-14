import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { getUserTenantInfo } from "@repo/db/services/tenant";

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const info = await getUserTenantInfo(session.user.id);
        if (!info) {
          return new Response(JSON.stringify({ tenantName: "Default", orgName: "" }), {
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify(info), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
