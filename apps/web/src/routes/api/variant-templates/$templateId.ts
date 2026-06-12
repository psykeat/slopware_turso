import { auth } from "@repo/auth/auth";
import {
  getVariantTemplate,
  updateVariantTemplate,
  VariantTemplateValidationError,
} from "@repo/db/services/variant-template";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/variant-templates/$templateId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as Record<string, unknown>).isSystemAdmin;
        const context = await resolveTenantContext(
          request,
          session.user.id,
          Boolean(isSystemAdmin),
        );
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        try {
          const template = await getVariantTemplate(context.tenantId, params.templateId);
          if (!template) {
            return new Response("Variant template not found", { status: 404 });
          }
          return new Response(JSON.stringify(template), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return new Response(message, { status: 400 });
        }
      },

      PATCH: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as Record<string, unknown>).isSystemAdmin;
        const context = await resolveTenantContext(
          request,
          session.user.id,
          Boolean(isSystemAdmin),
        );
        if (!context) {
          return new Response("No active tenant found", { status: 403 });
        }

        try {
          const body = (await request.json()) as Partial<{
            slug: string;
            label: string;
            articleGroupId: string | null;
            definition: unknown;
            archived: boolean;
          }>;

          const template = await updateVariantTemplate(context.tenantId, params.templateId, body);
          return new Response(JSON.stringify(template), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          if (err instanceof VariantTemplateValidationError) {
            return new Response(JSON.stringify({ errors: err.errors }), {
              status: 422,
              headers: { "content-type": "application/json" },
            });
          }
          const message = err instanceof Error ? err.message : "Unknown error";
          const status = message === "Variant template not found" ? 404 : 400;
          return new Response(message, { status });
        }
      },
    },
  },
});
