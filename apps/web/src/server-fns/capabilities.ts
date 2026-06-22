import { executeAction } from "@repo/db/actions";
import type {
  ActionInput,
  ActionKey,
  ActionMeta,
  ActionOutput,
  ActionResult,
} from "@repo/db/actions";
import type { CapabilityErrorCode, CapabilityIssue } from "@repo/db/capabilities";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { capabilityContext } from "./context";

// One generic server function for all registry actions instead of one RPC per
// action key. Type safety comes from the `capability(key)` compatibility factory below,
// whose generics resolve against the type-only CapabilityIndex — the server
// re-validates with the real zod schema inside executeAction anyway.
export const $executeCapability = createServerFn({ method: "POST" })
  .middleware([capabilityContext])
  .inputValidator(
    z.object({
      key: z.string(),
      input: z.unknown().optional(),
      dryRun: z.boolean().optional(),
      idempotencyKey: z.string().optional(),
    }),
  )
  .handler(async ({ data, context }) =>
    executeAction(
      data.key,
      {
        ...context.executionCtx,
        ...(data.dryRun ? { dryRun: true } : {}),
        ...(data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : {}),
      },
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
export async function callCapability<K extends ActionKey>(
  key: K,
  input: ActionInput<K>,
  opts?: CapabilityCallOptions,
): Promise<{ data: ActionOutput<K>; meta: ActionMeta }> {
  const result = (await $executeCapability({
    data: { key, input, dryRun: opts?.dryRun },
  })) as ActionResult<ActionOutput<K>>;
  if (!result.ok) throw new CapabilityClientError(result.error);
  return { data: result.data, meta: result.meta };
}

// Typed convenience: `await capability("sales.document.post")({ documentId })`.
export function capability<K extends ActionKey>(key: K) {
  return async (input: ActionInput<K>, opts?: CapabilityCallOptions): Promise<ActionOutput<K>> => {
    const { data } = await callCapability(key, input, opts);
    return data;
  };
}
