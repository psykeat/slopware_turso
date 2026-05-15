import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { documentGroup } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import { resolveTenantContext } from "#/lib/resolve-tenant";
import { DIRECTION_FROM_TYPE } from "@repo/db/services/document-service";

const TYPE_ORDER: Record<string, number> = {
  OUTBOUND: 1, INBOUND: 2, ADJUSTMENT: 3, PRODUCTION: 4,
};
const TYPE_SEQUENCE: Record<string, number> = {
  N: 1, A: 2, L: 3, R: 4, G: 5,
  b: 1, l: 2, r: 3, g: 4,
  V: 1, Z: 2, E: 3, U: 4,
  q: 1, p: 2,
};

export const Route = createFileRoute("/api/admin/document-groups/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        if (!isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const groups = await db
          .select()
          .from(documentGroup)
          .where(eq(documentGroup.tenantId, context.tenantId));

        groups.sort((a, b) => {
          const da = TYPE_ORDER[DIRECTION_FROM_TYPE[a.documentType] ?? ""] ?? 99;
          const db_ = TYPE_ORDER[DIRECTION_FROM_TYPE[b.documentType] ?? ""] ?? 99;
          if (da !== db_) return da - db_;
          const ta = TYPE_SEQUENCE[a.documentType] ?? 99;
          const tb = TYPE_SEQUENCE[b.documentType] ?? 99;
          if (ta !== tb) return ta - tb;
          return a.groupNumber - b.groupNumber;
        });

        return new Response(JSON.stringify(groups), {
          headers: { "content-type": "application/json" },
        });
      },

      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        if (!isSystemAdmin) return new Response("Forbidden", { status: 403 });

        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("No active tenant found", { status: 403 });

        const body = (await request.json()) as {
          documentType: string;
          name: string;
          groupNumber: number;
          isActive?: boolean;
          nextGroupId?: string | null;
          numberSequenceId?: string | null;
          defaultWarehouseId?: string | null;
        };

        const direction = DIRECTION_FROM_TYPE[body.documentType];
        if (!direction) return new Response("Invalid document type", { status: 400 });

        try {
          const [created] = await db
            .insert(documentGroup)
            .values({
              tenantId: context.tenantId,
              documentType: body.documentType,
              name: body.name,
              groupNumber: body.groupNumber,
              direction,
              isActive: body.isActive ?? true,
              nextGroupId: body.nextGroupId ?? null,
              numberSequenceId: body.numberSequenceId ?? null,
              defaultWarehouseId: body.defaultWarehouseId ?? null,
            })
            .returning();

          return new Response(JSON.stringify(created), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 400 });
        }
      },
    },
  },
});
