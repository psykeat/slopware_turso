import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { ImportService } from "@repo/db/services/import-service";

export const Route = createFileRoute("/api/import/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });
        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          const form = await request.formData();
          const profileId = form.get("profileId") as string | null;
          const tenantConnectorId = form.get("tenantConnectorId") as string | null;
          const delimiter = (form.get("delimiter") as string | null) ?? ",";
          const file = form.get("file") as File | null;

          if (!profileId) return new Response("profileId is required", { status: 400 });
          if (!tenantConnectorId)
            return new Response("tenantConnectorId is required", { status: 400 });
          if (!file) return new Response("file is required", { status: 400 });

          const csvText = await file.text();

          const svc = new ImportService(context.tenantId, session.user.id);
          const result = await svc.uploadCSV({
            csvText,
            profileId,
            tenantConnectorId,
            delimiter,
          });

          return new Response(JSON.stringify(result), {
            status: 201,
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 400 });
        }
      },
    },
  },
});
