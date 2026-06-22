import { auth } from "@repo/auth/auth";
import { db, runInTenantScope } from "@repo/db";
import { articleBom } from "@repo/db/schema";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/articles/$articleId/bom/$bomId")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const body = (await request.json()) as {
          quantity?: number;
          scrapPercentage?: number;
          sortOrder?: number;
        };

        const updates: Record<string, any> = {};
        if (body.quantity !== undefined) updates.quantity = String(body.quantity);
        if (body.scrapPercentage !== undefined)
          updates.scrapPercentage = String(body.scrapPercentage);
        if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

        if (Object.keys(updates).length === 0) {
          return new Response("No fields to update", { status: 400 });
        }

        return runInTenantScope(context, async () => {
          const [updated] = await db
            .update(articleBom)
            .set(updates)
            .where(and(eq(articleBom.bomId, params.bomId), eq(articleBom.archived, false)))
            .returning();

          if (!updated) return new Response("Not found", { status: 404 });

          return new Response(JSON.stringify({ bom: updated }), {
            headers: { "content-type": "application/json" },
          });
        });
      },

      DELETE: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        return runInTenantScope(context, async () => {
          const [updated] = await db
            .update(articleBom)
            .set({ archived: true })
            .where(and(eq(articleBom.bomId, params.bomId), eq(articleBom.archived, false)))
            .returning();

          if (!updated) return new Response("Not found", { status: 404 });

          return new Response(JSON.stringify({ success: true }), {
            headers: { "content-type": "application/json" },
          });
        });
      },
    },
  },
});
