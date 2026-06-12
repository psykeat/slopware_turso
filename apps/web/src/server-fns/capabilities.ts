import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { executeCapability } from "@repo/db/capabilities";
import type {
  CapabilityErrorCode,
  CapabilityInput,
  CapabilityIssue,
  CapabilityKey,
  CapabilityMeta,
  CapabilityOutput,
  CapabilityResult,
} from "@repo/db/capabilities";

import { capabilityContext } from "./context";

// One generic server function for all capabilities instead of one RPC per
// capability key. Type safety comes from the `capability(key)` factory below,
// whose generics resolve against the type-only CapabilityIndex — the server
// re-validates with the real zod schema inside executeCapability anyway.
export const $executeCapability = createServerFn({ method: "POST" })
  .middleware([capabilityContext])
  .inputValidator(
    z.object({
      key: z.string(),
      input: z.unknown().optional(),
      dryRun: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) =>
    executeCapability(
      data.key,
      data.dryRun ? { ...context.executionCtx, dryRun: true } : context.executionCtx,
      data.input,
    ),
  );

// Error envelopes become a typed exception on the client so forms can show
// validation issues and toasts can show the capability error code.
export class CapabilityClientError extends Error {
  readonly code: CapabilityErrorCode;
  readonly issues?: CapabilityIssue[];

  constructor(error: { code: CapabilityErrorCode; message: string; issues?: CapabilityIssue[] }) {
    super(error.message);
    this.name = "CapabilityClientError";
    this.code = error.code;
    this.issues = error.issues;
  }
}

export interface CapabilityCallOptions {
  dryRun?: boolean;
}

// Full envelope variant — used by the mutation hook, which needs meta
// (entityName/writesTables) to invalidate cached reads.
export async function callCapability<K extends CapabilityKey>(
  key: K,
  input: CapabilityInput<K>,
  opts?: CapabilityCallOptions,
): Promise<{ data: CapabilityOutput<K>; meta: CapabilityMeta }> {
  const result = (await $executeCapability({
    data: { key, input, dryRun: opts?.dryRun },
  })) as CapabilityResult<CapabilityOutput<K>>;
  if (!result.ok) throw new CapabilityClientError(result.error);
  return { data: result.data, meta: result.meta };
}

// Typed convenience: `await capability("sales.document.post")({ documentId })`.
export function capability<K extends CapabilityKey>(key: K) {
  return async (
    input: CapabilityInput<K>,
    opts?: CapabilityCallOptions,
  ): Promise<CapabilityOutput<K>> => {
    const { data } = await callCapability(key, input, opts);
    return data;
  };
}
