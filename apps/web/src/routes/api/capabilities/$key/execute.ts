import {
  executeCapability,
  getCapability,
  type CapabilityErrorCode,
  type CapabilityResult,
} from "@repo/db/capabilities";
import { createFileRoute } from "@tanstack/react-router";

import { resolveExecutionContext } from "#/lib/capability-auth";

const STATUS_BY_CODE: Record<CapabilityErrorCode, number> = {
  unknown_capability: 404,
  forbidden: 403,
  validation: 422,
  not_found: 404,
  conflict: 409,
  internal: 500,
};

function envelopeResponse(result: CapabilityResult): Response {
  const status = result.ok ? 200 : STATUS_BY_CODE[result.error.code];
  return new Response(JSON.stringify(result), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/capabilities/$key/execute")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const ctx = await resolveExecutionContext(request);
        if (ctx instanceof Response) return ctx;

        let body: { input?: unknown; dryRun?: boolean; idempotencyKey?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return envelopeResponse({
            ok: false,
            error: { code: "validation", message: "Request body must be JSON" },
          });
        }

        // Capabilities without HTTP exposure are indistinguishable from
        // unknown ones for HTTP callers.
        const capability = getCapability(params.key);
        if (!capability?.exposure.http) {
          return envelopeResponse({
            ok: false,
            error: { code: "unknown_capability", message: `Unknown capability "${params.key}"` },
          });
        }

        // idempotencyKey is accepted for forward compatibility; enforcement
        // (execution log with per-tenant uniqueness) is deferred to phase 4.
        const result = await executeCapability(
          params.key,
          { ...ctx, dryRun: Boolean(body.dryRun) },
          body.input ?? {},
        );
        return envelopeResponse(result);
      },
    },
  },
});
