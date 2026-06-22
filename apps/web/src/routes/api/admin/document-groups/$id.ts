import { auth } from "@repo/auth/auth";
import { db, runInTenantScope } from "@repo/db";
import { documentGroup } from "@repo/db/schema";
import { DIRECTION_FROM_TYPE } from "@repo/db/services/document-service";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

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

        return runInTenantScope(context, async () => {
          const [record] = await db
            .select()
            .from(documentGroup)
            .where(eq(documentGroup.documentGroupId, params.id))
            .limit(1);

          if (!record) return new Response("Not found", { status: 404 });

          return new Response(JSON.stringify(record), {
            headers: { "content-type": "application/json" },
          });
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
          return await runInTenantScope(context, async () => {
            const [updated] = await db
              .update(documentGroup)
              .set(body as any)
              .where(eq(documentGroup.documentGroupId, params.id))
              .returning();

            if (!updated) return new Response("Not found", { status: 404 });

            return new Response(JSON.stringify(updated), {
              headers: { "content-type": "application/json" },
            });
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

        return runInTenantScope(context, async () => {
          const [record] = await db
            .select()
            .from(documentGroup)
            .where(eq(documentGroup.documentGroupId, params.id))
            .limit(1);

          if (!record) return new Response("Not found", { status: 404 });

          if (record.groupNumber === 0) {
            return new Response("Basisgruppe kann nicht gelöscht werden", { status: 409 });
          }

          await db.delete(documentGroup).where(eq(documentGroup.documentGroupId, params.id));

          return new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json" },
          });
        });
      },
    },
  },
});
