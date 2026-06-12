import { auth } from "@repo/auth/auth";
import {
  createVariantTemplate,
  listVariantTemplates,
  VariantTemplateValidationError,
} from "@repo/db/services/variant-template";
import { createFileRoute } from "@tanstack/react-router";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/variant-templates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
          const url = new URL(request.url);
          const includeArchived = url.searchParams.get("includeArchived") === "true";
          const templates = await listVariantTemplates(context.tenantId, { includeArchived });
          return new Response(JSON.stringify(templates), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return new Response(message, { status: 400 });
        }
      },

      POST: async ({ request }) => {
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
          const body = (await request.json()) as {
            slug: string;
            label: string;
            articleGroupId?: string | null;
            definition: unknown;
          };

          const template = await createVariantTemplate(context.tenantId, body);
          return new Response(JSON.stringify(template), {
            status: 201,
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
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});
