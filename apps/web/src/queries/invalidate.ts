import type { QueryClient } from "@tanstack/react-query";

import type { CapabilityMeta } from "@repo/db/capabilities";

import { entityKeys } from "./keys";

// writesTables-driven invalidation: every capability declares which tables it
// writes, and the execute envelope echoes them in meta. Over-invalidation is
// fine; missing invalidation is not.
export function invalidateAfterCapability(queryClient: QueryClient, meta: CapabilityMeta) {
  const entities = new Set<string>([meta.entityName, ...meta.writesTables]);
  for (const entityName of entities) {
    void queryClient.invalidateQueries({ queryKey: entityKeys.entity(entityName) });
  }
}
