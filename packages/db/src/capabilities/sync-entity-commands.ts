import { and, eq, isNull } from "drizzle-orm";

import { db } from "../index";
import { entityCommands } from "../schema/app.schema";
import { capabilityInputJsonSchema } from "./core/json-schema";
import { listCapabilities } from "./index";

// jsonb columns come back with normalized key order; compare order-insensitively.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export interface SyncEntityCommandsReport {
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
}

// Projects the code-first capability registry into entity_commands so the AI
// discovery catalog and tenant-level overrides keep working. Code is the
// source of truth: global-scope rows with a handlerkey are owned by this sync;
// tenant/org-scope rows (label/visibility overrides) are never touched.
//
// Manual upsert instead of ON CONFLICT: the unique constraint includes the
// nullable organization_id/tenant_id columns, and NULLs never conflict.
export async function syncEntityCommands(): Promise<SyncEntityCommandsReport> {
  const report: SyncEntityCommandsReport = { created: 0, updated: 0, unchanged: 0, archived: 0 };
  const registry = listCapabilities();

  const globalRows = await db
    .select()
    .from(entityCommands)
    .where(
      and(
        eq(entityCommands.scope, "global"),
        isNull(entityCommands.organizationId),
        isNull(entityCommands.tenantId),
      ),
    );

  const rowsByEntityCommand = new Map(
    globalRows.map((row) => [`${row.entityName}::${row.commandKey}`, row]),
  );

  for (const capability of registry) {
    const projected = {
      handlerkey: capability.key,
      label: capability.summary,
      description: capability.description ?? null,
      httpMethod: "POST",
      routePattern: `/api/capabilities/${capability.key}/execute`,
      entityIdParam: null,
      inputSchema: capabilityInputJsonSchema(capability) as Record<string, unknown>,
      writesTables: capability.writesTables,
      sideEffects: capability.sideEffects,
      minRole: capability.minRole,
      visibility: capability.exposure.llm === "hidden" ? "hidden" : "tenant",
      commandState: "published",
      uiPlacement: capability.exposure.ui?.placement ?? null,
      uiIcon: capability.exposure.ui?.icon ?? null,
    };

    const existing = rowsByEntityCommand.get(`${capability.entityName}::${capability.operation}`);
    if (!existing) {
      await db.insert(entityCommands).values({
        scope: "global",
        organizationId: null,
        tenantId: null,
        entityName: capability.entityName,
        commandKey: capability.operation,
        ...projected,
      });
      report.created += 1;
      continue;
    }

    const isUnchanged =
      existing.handlerkey === projected.handlerkey &&
      existing.commandState === projected.commandState &&
      existing.routePattern === projected.routePattern &&
      existing.minRole === projected.minRole &&
      existing.visibility === projected.visibility &&
      stableStringify(existing.label) === stableStringify(projected.label) &&
      stableStringify(existing.description) === stableStringify(projected.description) &&
      stableStringify(existing.inputSchema) === stableStringify(projected.inputSchema) &&
      stableStringify(existing.writesTables) === stableStringify(projected.writesTables) &&
      stableStringify(existing.sideEffects) === stableStringify(projected.sideEffects);

    if (isUnchanged) {
      report.unchanged += 1;
      continue;
    }

    await db
      .update(entityCommands)
      .set(projected)
      .where(eq(entityCommands.commandId, existing.commandId));
    report.updated += 1;
  }

  // Rows this sync once owned (handlerkey set) whose capability is gone:
  // archive, never delete.
  const registryKeys = new Set(registry.map((capability) => capability.key));
  for (const row of globalRows) {
    if (!row.handlerkey || registryKeys.has(row.handlerkey)) continue;
    if (row.commandState === "archived") continue;
    await db
      .update(entityCommands)
      .set({ commandState: "archived" })
      .where(eq(entityCommands.commandId, row.commandId));
    report.archived += 1;
  }

  return report;
}
