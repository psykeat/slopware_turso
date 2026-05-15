import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { systemSettings } from "@repo/db/schema";
import { eq, and } from "drizzle-orm";

export const Route = createFileRoute("/api/admin/llm-config")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as Record<string, unknown>).isSystemAdmin;
        if (!isSystemAdmin) {
          return new Response("Forbidden", { status: 403 });
        }

        const body = (await request.json()) as {
          endpointUrl: string;
          model: string;
          apiKey: string;
          githubToken: string;
          githubRepo: string;
        };

        // Upsert into system_settings
        const existing = await db
          .select()
          .from(systemSettings)
          .where(
            and(
              eq(systemSettings.scope, "global"),
              eq(systemSettings.key, "llm_config"),
            ),
          )
          .limit(1);

        if (existing[0]) {
          await db
            .update(systemSettings)
            .set({
              value: body,
              updatedAt: new Date(),
            })
            .where(eq(systemSettings.settingId, existing[0].settingId));
        } else {
          await db.insert(systemSettings).values({
            scope: "global",
            key: "llm_config",
            value: body,
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
