import { capabilityDescriptor, getCapability } from "@repo/db/capabilities";
import { createFileRoute } from "@tanstack/react-router";

import { resolveExecutionContext } from "#/lib/capability-auth";

export const Route = createFileRoute("/api/capabilities/$key")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ctx = await resolveExecutionContext(request);
        if (ctx instanceof Response) return ctx;

        const capability = getCapability(params.key);
        if (
          !capability ||
          !capability.exposure.http ||
          (ctx.role === "tenant_user" && capability.minRole !== "tenant_user")
        ) {
          return new Response(JSON.stringify({ error: "Unknown capability" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify(capabilityDescriptor(capability, { includeOutput: true })),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
