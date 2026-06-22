import type { z } from "zod";

import type { CapabilityDefinition, CapabilityModule } from "./types";

// The key is derived, never declared, so it cannot drift from the
// module/entityName/operation triple used by registry/action discovery.
// The template-literal return type keeps the key a string literal, which the
// typed client factory (type-map.ts) relies on for input/output inference.
export function defineCapability<
  I extends z.ZodType,
  O extends z.ZodType,
  M extends CapabilityModule,
  E extends string,
  Op extends string,
>(
  definition: Omit<CapabilityDefinition<I, O>, "key" | "module" | "entityName" | "operation"> & {
    module: M;
    entityName: E;
    operation: Op;
  },
): CapabilityDefinition<I, O, `${M}.${E}.${Op}`> {
  if (definition.kind !== "read" && definition.writesTables.length === 0) {
    throw new Error(
      `Capability "${definition.module}.${definition.entityName}.${definition.operation}" writes data but declares no writesTables`,
    );
  }
  return {
    ...definition,
    key: `${definition.module}.${definition.entityName}.${definition.operation}`,
  };
}
