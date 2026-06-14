import {
  executeCapability,
  listCapabilities,
  type AnyCapability,
  type CapabilityResult,
  type ExecutionContext,
} from "@repo/db/capabilities";
import { toolDefinition } from "@tanstack/ai";

// AI projection of the capability runtime: the LLM never sees raw services and
// never receives a `tenantId` parameter. Every tool is a thin wrapper that
// delegates to `executeCapability` with a server-built ExecutionContext, so the
// AI write path is exactly the same gated path the UI and external callers use.

/** Default tool name, mirrored by the contract test in @repo/db. */
export function capabilityToolName(capability: AnyCapability): string {
  return (
    capability.exposure.ai?.toolName ??
    `${capability.module}_${capability.operation}_${capability.entityName}`
  );
}

export type ConfirmMode = "approval" | "exclude" | "allow";

export interface BuildCapabilityToolsOptions {
  /** Restrict to one projection group, e.g. "mail" | "sales-documents" | "catalog". */
  group?: string;
  /** Only capabilities flagged `activeByDefault`. Defaults to true. */
  activeByDefaultOnly?: boolean;
  /** Explicit capability-key allow-list. Overrides `group`/`activeByDefaultOnly`. */
  keys?: string[];
  /**
   * How to treat confirm-gated capabilities (`exposure.llm === "confirm"`):
   * - "approval" (default): emit with `needsApproval` so the client confirms.
   * - "exclude": leave them out of the toolset entirely (headless/autonomous runs).
   * - "allow": expose without an approval gate (trusted server contexts).
   */
  confirmMode?: ConfirmMode;
}

/**
 * Select the AI-exposed capabilities for a toolset. Hidden capabilities are
 * never eligible; a capability is AI-exposed exactly when it carries an
 * `exposure.ai` projection.
 */
export function listAiCapabilities(
  options: BuildCapabilityToolsOptions = {},
): AnyCapability[] {
  const exposed = listCapabilities({ llm: ["safe", "confirm"] }).filter(
    (capability) => capability.exposure.ai,
  );

  if (options.keys) {
    const allow = new Set(options.keys);
    return exposed.filter((capability) => allow.has(capability.key));
  }

  let result = exposed;
  if (options.group) {
    result = result.filter((capability) => capability.exposure.ai!.group === options.group);
  }
  if (options.activeByDefaultOnly ?? true) {
    result = result.filter((capability) => capability.exposure.ai!.activeByDefault);
  }
  if (options.confirmMode === "exclude") {
    result = result.filter((capability) => capability.exposure.llm !== "confirm");
  }
  return result;
}

/** Compose an LLM-facing description from the capability's AI projection. */
export function capabilityToolDescription(capability: AnyCapability): string {
  const ai = capability.exposure.ai;
  const parts: string[] = [capability.summary.en];
  if (ai?.useWhen?.length) parts.push(`Use when: ${ai.useWhen.join(" ")}`);
  if (ai?.avoidWhen?.length) parts.push(`Avoid when: ${ai.avoidWhen.join(" ")}`);
  if (ai?.requiredContext?.length) parts.push(`Requires: ${ai.requiredContext.join(", ")}.`);
  if (ai?.resultShape) parts.push(`Returns: ${ai.resultShape}.`);
  if (capability.exposure.llm === "confirm") {
    parts.push("This action changes data and requires user confirmation before it runs.");
  }
  return parts.join(" ");
}

/**
 * Turn a fixed set of capabilities into @tanstack/ai server tools. The `ctx` is
 * closed over so the model can never set tenant/actor itself — exactly the
 * factory pattern the bespoke mail tools used.
 */
function capabilitiesToTools(
  ctx: ExecutionContext,
  capabilities: AnyCapability[],
  confirmMode: ConfirmMode,
) {
  const requireApproval = confirmMode === "approval";

  return capabilities.map((capability) => {
    const definition = toolDefinition({
      name: capabilityToolName(capability),
      description: capabilityToolDescription(capability),
      // The capability's own zod input schema is the contract. It never
      // contains `tenantId` — that is resolved server-side from `ctx`.
      inputSchema: capability.input,
      ...(requireApproval && capability.exposure.llm === "confirm"
        ? { needsApproval: true }
        : {}),
    });

    return definition.server(async (input: unknown) => {
      const result: CapabilityResult = await executeCapability(capability.key, ctx, input);
      if (result.ok) {
        return { ok: true, data: result.data };
      }
      return { ok: false, error: result.error };
    });
  });
}

/**
 * Build the @tanstack/ai server tools for one request from a group/keys scope.
 */
export function buildCapabilityTools(
  ctx: ExecutionContext,
  options: BuildCapabilityToolsOptions = {},
) {
  return capabilitiesToTools(ctx, listAiCapabilities(options), options.confirmMode ?? "approval");
}

export interface OverlayToolsOptions {
  /**
   * The conversation's focused group(s), seeded from the Invocation Context.
   * A single value or several (e.g. a mail thread about a quote naturally spans
   * `["mail", "sales-documents"]`). Writes are curated to these groups.
   */
  focusGroups?: string | string[];
  /** Confirm policy for write capabilities. Defaults to "approval". */
  confirmMode?: ConfirmMode;
}

/**
 * Select the overlay's capabilities under the **"reads global, writes scoped"**
 * rule:
 * - **Backbone** — every AI-exposed `kind: "read"` capability across *all*
 *   groups. This is the Exploration backbone and never a thinking boundary, so
 *   the model can look anything up regardless of the focused group.
 * - **Focus group** — every AI-exposed capability (read *and* write) in the
 *   group seeded from the Invocation Context. Writes are curated to this group;
 *   switching focus widens the writable set.
 */
export function selectOverlayCapabilities(
  focusGroups?: string | string[],
): AnyCapability[] {
  const focus = new Set(typeof focusGroups === "string" ? [focusGroups] : (focusGroups ?? []));
  const exposed = listCapabilities({ llm: ["safe", "confirm"] }).filter(
    (capability) => capability.exposure.ai,
  );

  const selected = new Map<string, AnyCapability>();
  for (const capability of exposed) {
    const isBackboneRead = capability.kind === "read";
    const inFocusGroup = focus.has(capability.exposure.ai!.group);
    if (isBackboneRead || inFocusGroup) {
      selected.set(capability.key, capability);
    }
  }
  return [...selected.values()];
}

/**
 * Build the interactive overlay toolset (`/api/ai/chat`). Reads are global,
 * writes are scoped to the focused group(s) and gated by the approval handshake.
 */
export function buildOverlayTools(ctx: ExecutionContext, options: OverlayToolsOptions = {}) {
  return capabilitiesToTools(
    ctx,
    selectOverlayCapabilities(options.focusGroups),
    options.confirmMode ?? "approval",
  );
}
