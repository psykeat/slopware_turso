import { createFileRoute } from "@tanstack/react-router";
import { db } from "@repo/db";
import * as schema from "@repo/db/schema";
import { auth } from "@repo/auth/auth";
import { eq } from "drizzle-orm";

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
