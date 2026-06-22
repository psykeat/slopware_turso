import {
  executeAction,
  listActions,
  type ActionExecutionContext,
  type ActionResult,
  type AnyRegistryBackedAction,
} from "@repo/db/actions";
import { toolDefinition } from "@tanstack/ai";

// AI projection of the registry action runtime: the LLM never sees raw services and
// never receives a `tenantId` parameter. Every tool is a thin wrapper that
// delegates to `executeAction` with a server-built execution context, so the
// AI write path is exactly the same gated path the UI and external callers use.

/** Default tool name, mirrored by the contract test in @repo/db. */
export function actionToolName(action: AnyRegistryBackedAction): string {
  return (
    action.exposure.ai?.toolName ?? `${action.module}_${action.operation}_${action.entityName}`
  );
}

export type ConfirmMode = "approval" | "exclude" | "allow";

export interface BuildActionToolsOptions {
  /** Restrict to one projection group, e.g. "mail" | "sales-documents" | "catalog". */
  group?: string;
  /** Only actions flagged `activeByDefault`. Defaults to true. */
  activeByDefaultOnly?: boolean;
  /** Explicit action-key allow-list. Overrides `group`/`activeByDefaultOnly`. */
  keys?: string[];
  /**
   * How to treat confirm-gated actions (`exposure.llm === "confirm"`):
   * - "approval" (default): emit with `needsApproval` so the client confirms.
   * - "exclude": leave them out of the toolset entirely (headless/autonomous runs).
   * - "allow": expose without an approval gate (trusted server contexts).
   */
  confirmMode?: ConfirmMode;
}

/**
 * Select the AI-exposed actions for a toolset. Hidden actions are
 * never eligible; an action is AI-exposed exactly when it carries an
 * `exposure.ai` projection.
 */
export function listAiActions(options: BuildActionToolsOptions = {}): AnyRegistryBackedAction[] {
  const exposed = listActions({ llm: ["safe", "confirm"] }).filter((action) => action.exposure.ai);

  if (options.keys) {
    const allow = new Set(options.keys);
    return exposed.filter((action) => allow.has(action.key));
  }

  let result = exposed;
  if (options.group) {
    result = result.filter((action) => action.exposure.ai!.group === options.group);
  }
  if (options.activeByDefaultOnly ?? true) {
    result = result.filter((action) => action.exposure.ai!.activeByDefault);
  }
  if (options.confirmMode === "exclude") {
    result = result.filter((action) => action.exposure.llm !== "confirm");
  }
  return result;
}

/** Compose an LLM-facing description from the action's AI projection. */
export function actionToolDescription(action: AnyRegistryBackedAction): string {
  const ai = action.exposure.ai;
  const parts: string[] = [action.summary.en];
  if (ai?.useWhen?.length) parts.push(`Use when: ${ai.useWhen.join(" ")}`);
  if (ai?.avoidWhen?.length) parts.push(`Avoid when: ${ai.avoidWhen.join(" ")}`);
  if (ai?.requiredContext?.length) parts.push(`Requires: ${ai.requiredContext.join(", ")}.`);
  if (ai?.resultShape) parts.push(`Returns: ${ai.resultShape}.`);
  if (action.exposure.llm === "confirm") {
    parts.push("This action changes data and requires user confirmation before it runs.");
  }
  return parts.join(" ");
}

/**
 * Turn a fixed set of actions into @tanstack/ai server tools. The `ctx` is
 * closed over so the model can never set tenant/actor itself — exactly the
 * factory pattern the bespoke mail tools used.
 */
function actionsToTools(
  ctx: ActionExecutionContext,
  actions: AnyRegistryBackedAction[],
  confirmMode: ConfirmMode,
) {
  const requireApproval = confirmMode === "approval";

  return actions.map((action) => {
    const definition = toolDefinition({
      name: actionToolName(action),
      description: actionToolDescription(action),
      // The action's own zod input schema is the contract. It never
      // contains `tenantId` — that is resolved server-side from `ctx`.
      inputSchema: action.input,
      ...(requireApproval && action.exposure.llm === "confirm" ? { needsApproval: true } : {}),
    });

    return definition.server(async (input: unknown) => {
      const result: ActionResult = await executeAction(action.key, ctx, input);
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
export function buildActionTools(
  ctx: ActionExecutionContext,
  options: BuildActionToolsOptions = {},
) {
  return actionsToTools(ctx, listAiActions(options), options.confirmMode ?? "approval");
}

export interface OverlayToolsOptions {
  /**
   * The conversation's focused group(s), seeded from the Invocation Context.
   * A single value or several (e.g. a mail thread about a quote naturally spans
   * `["mail", "sales-documents"]`). Writes are curated to these groups.
   */
  focusGroups?: string | string[];
  /** Confirm policy for write actions. Defaults to "approval". */
  confirmMode?: ConfirmMode;
}

/**
 * Select the overlay's actions under the **"reads global, writes scoped"**
 * rule:
 * - **Backbone** — every AI-exposed `kind: "read"` action across *all*
 *   groups. This is the Exploration backbone and never a thinking boundary, so
 *   the model can look anything up regardless of the focused group.
 * - **Focus group** — every AI-exposed action (read *and* write) in the
 *   group seeded from the Invocation Context. Writes are curated to this group;
 *   switching focus widens the writable set.
 */
export function selectOverlayActions(focusGroups?: string | string[]): AnyRegistryBackedAction[] {
  const focus = new Set(typeof focusGroups === "string" ? [focusGroups] : (focusGroups ?? []));
  const exposed = listActions({ llm: ["safe", "confirm"] }).filter((action) => action.exposure.ai);

  const selected = new Map<string, AnyRegistryBackedAction>();
  for (const action of exposed) {
    const isBackboneRead = action.kind === "read";
    const aiGroup = action.exposure.ai?.group;
    const inFocusGroup = aiGroup ? focus.has(aiGroup) : false;
    if (isBackboneRead || inFocusGroup) {
      selected.set(action.key, action);
    }
  }
  return [...selected.values()];
}

/**
 * Build the interactive overlay toolset (`/api/ai/chat`). Reads are global,
 * writes are scoped to the focused group(s) and gated by the approval handshake.
 */
export function buildOverlayTools(ctx: ActionExecutionContext, options: OverlayToolsOptions = {}) {
  return actionsToTools(
    ctx,
    selectOverlayActions(options.focusGroups),
    options.confirmMode ?? "approval",
  );
}

export type BuildCapabilityToolsOptions = BuildActionToolsOptions;
export type AnyCapability = AnyRegistryBackedAction;
export type ExecutionContext = ActionExecutionContext;
export const capabilityToolName = actionToolName;
export const capabilityToolDescription = actionToolDescription;
export const listAiCapabilities = listAiActions;
export const buildCapabilityTools = buildActionTools;
export const selectOverlayCapabilities = selectOverlayActions;
