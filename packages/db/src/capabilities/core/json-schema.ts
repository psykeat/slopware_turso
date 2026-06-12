import { z } from "zod";

import type { AnyCapability } from "./types";

// `unrepresentable: "any"` keeps schemas with z.date() (timestamps in output
// records) convertible; those fields serialize as ISO strings over HTTP anyway.
export function capabilityInputJsonSchema(capability: AnyCapability) {
  return z.toJSONSchema(capability.input, { io: "input", unrepresentable: "any" });
}

export function capabilityOutputJsonSchema(capability: AnyCapability) {
  return z.toJSONSchema(capability.output, { io: "output", unrepresentable: "any" });
}

export function capabilityDescriptor(
  capability: AnyCapability,
  opts?: { includeOutput?: boolean },
) {
  return {
    key: capability.key,
    module: capability.module,
    entityName: capability.entityName,
    operation: capability.operation,
    kind: capability.kind,
    summary: capability.summary,
    description: capability.description ?? null,
    writesTables: capability.writesTables,
    sideEffects: capability.sideEffects,
    idempotent: capability.idempotent,
    supportsDryRun: capability.supportsDryRun,
    minRole: capability.minRole,
    exposure: capability.exposure,
    schemaVersion: capability.schemaVersion,
    inputSchema: capabilityInputJsonSchema(capability),
    ...(opts?.includeOutput ? { outputSchema: capabilityOutputJsonSchema(capability) } : {}),
  };
}
