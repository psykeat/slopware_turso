import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { documentGroup } from "@repo/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { DIRECTION_FROM_TYPE } from "@repo/db/services/document-service";

export const Route = createFileRoute("/api/admin/document-groups/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        if (!isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const [record] = await db
          .select()
          .from(documentGroup)
          .where(
            and(
              eq(documentGroup.documentGroupId, params.id),
              eq(documentGroup.tenantId, context.tenantId),
            ),
          )
          .limit(1);

        if (!record) return new Response("Not found", { status: 404 });

        return new Response(JSON.stringify(record), {
          headers: { "content-type": "application/json" },
        });
      },

      PATCH: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        if (!isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const body = (await request.json()) as Record<string, unknown>;

        if (body.documentType && typeof body.documentType === "string") {
          const dir = DIRECTION_FROM_TYPE[body.documentType];
          if (!dir) return new Response("Invalid document type", { status: 400 });
          body.direction = dir;
        }

        body.updatedAt = new Date();

        try {
          const [updated] = await db
            .update(documentGroup)
            .set(body as any)
            .where(
              and(
                eq(documentGroup.documentGroupId, params.id),
                eq(documentGroup.tenantId, context.tenantId),
              ),
            )
            .returning();

          if (!updated) return new Response("Not found", { status: 404 });

          return new Response(JSON.stringify(updated), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 400 });
        }
      },

      DELETE: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        if (!isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const [record] = await db
          .select()
          .from(documentGroup)
          .where(
            and(
              eq(documentGroup.documentGroupId, params.id),
              eq(documentGroup.tenantId, context.tenantId),
            ),
          )
          .limit(1);

        if (!record) return new Response("Not found", { status: 404 });

        if (record.groupNumber === 0) {
          return new Response("Basisgruppe kann nicht gelöscht werden", { status: 409 });
        }

        await db
          .delete(documentGroup)
          .where(
            and(
              eq(documentGroup.documentGroupId, params.id),
              eq(documentGroup.tenantId, context.tenantId),
            ),
          );

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
