import { auth } from "@repo/auth/auth";
import { runInTenantScope } from "@repo/db";
import { ImportService } from "@repo/db/services/import-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/import/profiles/$profileId/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const context = await resolveTenantContext(
          request,
          session.user.id,
          Boolean((session.user as { isSystemAdmin?: boolean }).isSystemAdmin),
        );
        if (!context) return new Response("Forbidden", { status: 403 });

        const url = new URL(request.url);
        const tenantConnectorId = url.searchParams.get("tenantConnectorId");
        const targetFileName = url.searchParams.get("targetFileName");
        const delimiter = url.searchParams.get("delimiter") ?? undefined;
        if (!tenantConnectorId || !targetFileName) {
          return Response.json(
            { error: "tenantConnectorId and targetFileName are required" },
            { status: 400 },
          );
        }

        const schemaCsvText = await request.text();
        const result = await runInTenantScope(context, async () => {
          return await new ImportService(
            context.tenantId,
            session.user.id,
          ).bootstrapBuerowareMapping({
            profileId: params.profileId,
            tenantConnectorId,
            targetFileName,
            schemaCsvText,
            delimiter,
          });
        });

        return Response.json(result);
      },
    },
  },
});
