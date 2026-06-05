import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { user } from "@repo/db/schema";
import { getUserTenantInfo, getTenantInfoById, getUserTenantRole } from "@repo/db/services/tenant";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        let info = null;

        if (isSystemAdmin) {
          const activeTenantId = parseCookie(request.headers.get("cookie"), "x-active-tenant");
          if (activeTenantId) {
            info = await getTenantInfoById(activeTenantId);
          }
        }

        if (!info) {
          info = await getUserTenantInfo(session.user.id);
        }

        const [userPrefs] = await db
          .select({ lastCompanyId: user.lastCompanyId })
          .from(user)
          .where(eq(user.id, session.user.id))
          .limit(1);

        if (!info) {
          return new Response(
            JSON.stringify({
              userId: session.user.id,
              isSystemAdmin,
              tenantId: null,
              tenantName: "Default",
              orgName: "",
              isBase: false,
              tenantRole: null,
              lastCompanyId: userPrefs?.lastCompanyId ?? null,
            }),
            {
              headers: { "content-type": "application/json" },
            },
          );
        }

        const tenantRole = info?.tenantId
          ? await getUserTenantRole(session.user.id, info.tenantId)
          : null;

        const tenantInfo = { ...(info as Record<string, unknown>) };
        delete tenantInfo.role;

        return new Response(
          JSON.stringify({
            ...tenantInfo,
            userId: session.user.id,
            isSystemAdmin,
            tenantRole,
            lastCompanyId: userPrefs?.lastCompanyId ?? null,
          }),
          {
            headers: { "content-type": "application/json" },
          },
        );
      },
    },
  },
});
