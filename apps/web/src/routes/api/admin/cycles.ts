import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { devCycles } from "@repo/db/schema";
import { desc } from "drizzle-orm";

export const Route = createFileRoute("/api/admin/cycles")({
  server: {
    handlers: {
      // ------------------------------------------------------------------
      // GET — return last 50 cycles, admin session required
      // ------------------------------------------------------------------
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const isSystemAdmin = (session.user as Record<string, unknown>).isSystemAdmin;
        if (!isSystemAdmin) {
          return new Response("Forbidden", { status: 403 });
        }

        const rows = await db
          .select()
          .from(devCycles)
          .orderBy(desc(devCycles.recordedAt))
          .limit(50);

        return new Response(JSON.stringify(rows), {
          headers: { "content-type": "application/json" },
        });
      },

      // ------------------------------------------------------------------
      // POST — create a new cycle entry; Bearer token auth for AI worker
      // ------------------------------------------------------------------
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const expectedToken = process.env.CYCLE_API_KEY ?? "";
        if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as {
          cycleNumber: number;
          sliceFitScore: number;
          sliceFitMax: number;
          storyCoverage: number;
          storyCoverageMax: number;
          testsAdded: number;
          vpTestPass?: boolean;
          blocker?: string;
          processAdjustment?: string;
        };

        const [row] = await db
          .insert(devCycles)
          .values({
            cycleNumber: body.cycleNumber,
            sliceFitScore: body.sliceFitScore,
            sliceFitMax: body.sliceFitMax,
            storyCoverage: body.storyCoverage,
            storyCoverageMax: body.storyCoverageMax,
            testsAdded: body.testsAdded ?? 0,
            vpTestPass: body.vpTestPass ?? null,
            blocker: body.blocker ?? null,
            processAdjustment: body.processAdjustment ?? null,
          })
          .returning();

        return new Response(JSON.stringify(row), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
