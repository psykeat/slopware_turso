import type { z } from "zod";

import type { CapabilityDefinition } from "./types";

// The key is derived, never declared, so it cannot drift from the
// module/entityName/operation triple used by discovery and entityCommands.
export function defineCapability<I extends z.ZodType, O extends z.ZodType>(
  definition: Omit<CapabilityDefinition<I, O>, "key">,
): CapabilityDefinition<I, O> {
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
