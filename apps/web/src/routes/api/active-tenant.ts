import { auth } from "@repo/auth/auth";
import { createFileRoute } from "@tanstack/react-router";

const COOKIE = "x-active-tenant";

export const Route = createFileRoute("/api/active-tenant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) return new Response("Unauthorized", { status: 401 });
        if (!(session.user as any).isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const { tenantId } = (await request.json()) as { tenantId: string | null };
        const headers = new Headers({ "content-type": "application/json" });

        if (tenantId) {
          const { getTenantContextById } = await import("@repo/db/services/tenant");
          const tenant = await getTenantContextById(tenantId);
          if (!tenant || !(tenant as any).isActive) {
            return new Response("Tenant is inactive or does not exist", { status: 403 });
          }
          headers.set(
            "Set-Cookie",
            `${COOKIE}=${encodeURIComponent(tenantId)}; Path=/; HttpOnly; SameSite=Lax`,
          );
        } else {
          headers.set("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
        }

        return new Response(JSON.stringify({ ok: true }), { headers });
      },
    },
  },
});
