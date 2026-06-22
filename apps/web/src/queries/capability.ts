import type { ActionInput, ActionKey, ActionOutput } from "@repo/db/actions";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { UseQueryOptions, UseSuspenseQueryOptions } from "@tanstack/react-query";

import { callCapability, capability } from "#/server-fns/capabilities";
import type { CapabilityCallOptions } from "#/server-fns/capabilities";

import { invalidateAfterCapability } from "./invalidate";
import { entityKeys } from "./keys";

function entityNameFromKey(key: ActionKey): string {
  return key.split(".")[1] ?? key;
}

// Shared queryOptions factory for read capabilities. Per-entity query modules
// (queries/documents.ts, …) wrap this with named exports; route files should
// not call it with ad-hoc keys.
export function capabilityQueryOptions<K extends ActionKey>(key: K, input: ActionInput<K>) {
  return queryOptions({
    queryKey: entityKeys.operation(entityNameFromKey(key), key, input),
    queryFn: () => capability(key)(input),
  });
}

// Mutation hook with automatic writesTables-driven invalidation.
export function useCapabilityMutation<K extends ActionKey>(
  key: K,
  options?: {
    dryRun?: CapabilityCallOptions["dryRun"];
    onSuccess?: (data: ActionOutput<K>) => void;
    onError?: (error: unknown) => void;
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ActionInput<K>) => callCapability(key, input, { dryRun: options?.dryRun }),
    onSuccess: (result) => {
      invalidateAfterCapability(queryClient, result.meta);
      options?.onSuccess?.(result.data);
    },
    onError: options?.onError,
  });
}

// Type-safe hook for capability read queries.
export function useCapabilityQuery<K extends ActionKey, TData = ActionOutput<K>>(
  key: K,
  input: ActionInput<K>,
  options?: Omit<UseQueryOptions<ActionOutput<K>, Error, TData>, "queryKey" | "queryFn">,
): any {
  return useQuery({
    ...capabilityQueryOptions(key, input),
    ...options,
  } as any);
}

// Type-safe hook for React Suspense read queries.
export function useCapabilitySuspenseQuery<K extends ActionKey, TData = ActionOutput<K>>(
  key: K,
  input: ActionInput<K>,
  options?: Omit<UseSuspenseQueryOptions<ActionOutput<K>, Error, TData>, "queryKey" | "queryFn">,
): any {
  return useSuspenseQuery({
    ...capabilityQueryOptions(key, input),
    ...options,
  } as any);
}
