import { auth } from "@repo/auth/auth";
import { LogisticsService } from "@repo/db/services/logistics-service";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/documents/import-tracking")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        try {
          let csvContent = "";
          const contentType = request.headers.get("content-type") || "";

          if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            let file: File | null = null;
            for (const value of formData.values()) {
              if (value instanceof File) {
                file = value;
                break;
              }
            }
            if (!file) {
              return new Response("No file uploaded in the form data", { status: 400 });
            }
            csvContent = await file.text();
          } else {
            csvContent = await request.text();
          }

          if (!csvContent) {
            return new Response("CSV content is required", { status: 400 });
          }

          const svc = new LogisticsService();
          const { updatedCount } = await svc.importTrackingCSV(context.tenantId, csvContent);

          return new Response(
            JSON.stringify({
              success: true,
              count: updatedCount,
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        } catch (error: any) {
          console.error("Failed to import tracking CSV:", error);
          return new Response(error.message || "Failed to import tracking CSV", { status: 500 });
        }
      },
    },
  },
});
