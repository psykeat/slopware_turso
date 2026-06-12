import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import type { CapabilityInput, CapabilityKey, CapabilityOutput } from "@repo/db/capabilities";

import { callCapability, capability } from "#/server-fns/capabilities";
import type { CapabilityCallOptions } from "#/server-fns/capabilities";

import { invalidateAfterCapability } from "./invalidate";
import { entityKeys } from "./keys";

function entityNameFromKey(key: CapabilityKey): string {
  return key.split(".")[1] ?? key;
}

// Shared queryOptions factory for read capabilities. Per-entity query modules
// (queries/documents.ts, …) wrap this with named exports; route files should
// not call it with ad-hoc keys.
export function capabilityQueryOptions<K extends CapabilityKey>(
  key: K,
  input: CapabilityInput<K>,
) {
  return queryOptions({
    queryKey: entityKeys.operation(entityNameFromKey(key), key, input),
    queryFn: () => capability(key)(input),
  });
}

// Mutation hook with automatic writesTables-driven invalidation.
export function useCapabilityMutation<K extends CapabilityKey>(
  key: K,
  options?: {
    dryRun?: CapabilityCallOptions["dryRun"];
    onSuccess?: (data: CapabilityOutput<K>) => void;
    onError?: (error: unknown) => void;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CapabilityInput<K>) =>
      callCapability(key, input, { dryRun: options?.dryRun }),
    onSuccess: (result) => {
      invalidateAfterCapability(queryClient, result.meta);
      options?.onSuccess?.(result.data);
    },
    onError: options?.onError,
  });
}
