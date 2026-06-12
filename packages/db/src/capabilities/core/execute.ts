import type { z } from "zod";

import { VariantTemplateValidationError } from "../../services/variant-template";
import { getCapability } from "./registry";
import {
  CapabilityError,
  type AnyCapability,
  type CapabilityErrorCode,
  type CapabilityIssue,
  type CapabilityResult,
  type ExecutionContext,
} from "./types";

const ROLE_RANK = { tenant_user: 0, tenant_admin: 1, system: 2 } as const;

function roleSatisfies(ctx: ExecutionContext, capability: AnyCapability): boolean {
  if (ctx.actorMode === "system" || ctx.actorMode === "test") return true;
  return ROLE_RANK[ctx.role] >= ROLE_RANK[capability.minRole];
}

function zodIssues(error: z.ZodError): CapabilityIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

type CapabilityFailure = Extract<CapabilityResult<never>, { ok: false }>;

function failure(
  code: CapabilityErrorCode,
  message: string,
  issues?: CapabilityIssue[],
): CapabilityFailure {
  return { ok: false, error: issues ? { code, message, issues } : { code, message } };
}

function mapHandlerError(err: unknown, ctx: ExecutionContext): CapabilityFailure["error"] {
  if (err instanceof CapabilityError) {
    return { code: err.code, message: err.message, issues: err.issues };
  }
  if (err instanceof VariantTemplateValidationError) {
    return {
      code: "validation",
      message: err.message,
      issues: err.errors.map((message) => ({ path: "", message })),
    };
  }
  if (err instanceof Error) {
    // postgres.js surfaces constraint violations with the SQLSTATE on `code`.
    if ((err as { code?: string }).code === "23505") {
      return { code: "conflict", message: "A record with the same unique key already exists" };
    }
    if (/not found/i.test(err.message)) {
      return { code: "not_found", message: err.message };
    }
    if (/is archived/i.test(err.message)) {
      return { code: "conflict", message: err.message };
    }
  }
  const message =
    ctx.actorMode === "external"
      ? "Internal error"
      : err instanceof Error
        ? err.message
        : "Internal error";
  return { code: "internal", message };
}

export async function executeCapability<T = unknown>(
  key: string,
  ctx: ExecutionContext,
  rawInput: unknown,
): Promise<CapabilityResult<T>> {
  const startedAt = performance.now();

  const capability = getCapability(key);
  if (!capability) {
    return failure("unknown_capability", `Unknown capability "${key}"`);
  }

  if (!roleSatisfies(ctx, capability)) {
    return failure("forbidden", `Capability "${key}" requires role "${capability.minRole}"`);
  }

  const parsed = capability.input.safeParse(rawInput);
  if (!parsed.success) {
    return failure("validation", `Invalid input for "${key}"`, zodIssues(parsed.error));
  }

  if (ctx.dryRun && !capability.supportsDryRun) {
    return failure("validation", `Capability "${key}" does not support dryRun`);
  }

  try {
    const data = await capability.handler(ctx, parsed.data);

    // Contract drift guard: only outside production (or for test actors) so
    // it catches mismatches in dev/CI without taxing the hot path.
    if (process.env.NODE_ENV !== "production" || ctx.actorMode === "test") {
      const output = capability.output.safeParse(data);
      if (!output.success) {
        return failure(
          "internal",
          `Capability "${key}" violated its output contract`,
          zodIssues(output.error),
        );
      }
    }

    return {
      ok: true,
      data: data as T,
      meta: {
        capability: key,
        entityName: capability.entityName,
        writesTables: capability.writesTables,
        schemaVersion: capability.schemaVersion,
        dryRun: Boolean(ctx.dryRun),
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      },
    };
  } catch (err) {
    return { ok: false, error: mapHandlerError(err, ctx) };
  }
}
