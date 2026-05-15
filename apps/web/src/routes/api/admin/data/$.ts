import { createFileRoute } from "@tanstack/react-router";
import { db } from "@repo/db";
import * as schema from "@repo/db/schema";
import { auth } from "@repo/auth/auth";
import { eq } from "drizzle-orm";
import { DataService } from "@repo/db/services/data";

export const Route = createFileRoute("/api/admin/data/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user || !(session.user as any)?.isSystemAdmin) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        const entityName = url.pathname.split("/").pop();
        if (!entityName) return new Response("Bad Request", { status: 400 });

        const table = (schema as any)[entityName];
        if (!table) return new Response("Not Found", { status: 404 });

        try {
          const paginated = url.searchParams.get("paginated") === "true";
          if (paginated) {
            // ... (keep existing pagination logic)
            const limit = Math.max(1, Number(url.searchParams.get("limit") ?? "50"));
            const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
            const offset = (page - 1) * limit;
            const orderBy = url.searchParams.get("orderBy") ?? undefined;
            const search = url.searchParams.get("search") ?? undefined;
            const filtersParam = url.searchParams.get("filters");
            let filterRules: Array<{ col: string; op: string; val: string }> | undefined;
            if (filtersParam) {
              try { filterRules = JSON.parse(filtersParam); } catch { /* ignore */ }
            }
            const service = new DataService("", true);
            const result = await service.list(entityName, {}, { limit, offset, orderBy, count: true, search, filterRules }) as { data: any[]; total: number };
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // Specialized joins for Admin visibility
          if (entityName === "userTenant") {
            const results = await db
              .select({
                id: schema.userTenant.id,
                userId: schema.userTenant.userId,
                userName: schema.user.name,
                tenantId: schema.userTenant.tenantId,
                tenantName: schema.tenant.name,
                role: schema.userTenant.role,
              })
              .from(schema.userTenant)
              .innerJoin(schema.user, eq(schema.userTenant.userId, schema.user.id))
              .innerJoin(schema.tenant, eq(schema.userTenant.tenantId, schema.tenant.tenantId));
            
            return new Response(JSON.stringify(results), {
              headers: { "content-type": "application/json" },
            });
          }

          // System admin can see all records without tenant filter
          const data = await db.select().from(table);
          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user || !(session.user as any)?.isSystemAdmin) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        const entityName = url.pathname.split("/").pop();
        if (!entityName) return new Response("Bad Request", { status: 400 });

        const table = (schema as any)[entityName];
        if (!table) return new Response("Not Found", { status: 404 });

        try {
          const body = await request.json();

          // Auto-generate slug if missing for tenant/org
          if ((entityName === "tenant" || entityName === "organization") && body.name && !body.slug) {
            body.slug = body.name.toString().toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)+/g, '');
          }

          const result = await db.insert(table).values(body).returning();
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 500 });
        }
      },
      PATCH: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session || !session.user || !(session.user as any)?.isSystemAdmin) {
          return new Response("Unauthorized", { status: 401 });
        }

        const url = new URL(request.url);
        const segments = url.pathname.split("/");
        const id = segments.pop();
        const entityName = segments.pop();

        if (!entityName || !id) return new Response("Bad Request", { status: 400 });

        const table = (schema as any)[entityName];
        if (!table) return new Response("Not Found", { status: 404 });

        const pkColumn = table[Object.keys(table).find((k) => k.endsWith("Id")) || "id"];

        try {
          const body = await request.json();
          const result = await db.update(table).set(body).where(eq(pkColumn, id)).returning();
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(err.message, { status: 500 });
        }
      },
    },
  },
});
