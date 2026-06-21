import {
  capabilityDescriptor,
  listCapabilities,
  type CapabilityModule,
} from "@repo/db/capabilities";
import { discoverEntities } from "@repo/registry";
import { createFileRoute } from "@tanstack/react-router";

import { resolveExecutionContext } from "#/lib/capability-auth";

export const Route = createFileRoute("/api/capabilities")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await resolveExecutionContext(request);
        if (ctx instanceof Response) return ctx;

        const url = new URL(request.url);
        const module = url.searchParams.get("module") ?? undefined;
        const entityName = url.searchParams.get("entityName") ?? undefined;

        let capabilities = listCapabilities({
          httpOnly: true,
          module: module as CapabilityModule | undefined,
          entityName,
        });
        if (ctx.role === "tenant_user") {
          capabilities = capabilities.filter((c) => c.minRole === "tenant_user");
        }

        return new Response(
          JSON.stringify({
            capabilities: capabilities.map((c) => capabilityDescriptor(c)),
            entities: discoverEntities({ module, entityName }),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
