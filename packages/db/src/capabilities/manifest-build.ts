import type { AnyCapability } from "./core/types";

// Pure projection of the capability registry into a per-entity operation map.
// The generic TriView grid does POST/PATCH/DELETE on a *dynamic* entityName but
// capability ops are heterogeneous — and not only in which ops exist: their
// *input shapes* differ too (factory CRUD takes `{ filters }` / `{ id }`, while
// hand-written caps take flat FK fields and entity-specific id params like
// `optionId` / `documentId`). We introspect each input schema at generation time
// and bake the shape facts the runtime resolver needs (idParam, filtersWrapped)
// into the manifest. It stays STRINGS ONLY so the generated file is safe to
// import from client bundles.

export interface EntityCapabilityOp {
  /** Full capability key (`${module}.${entityName}.${operation}`). */
  key: string;
  /** For id-addressed ops (get/update/archive/delete): the input key holding the record id. */
  idParam?: string;
  /** For list: true if FK filters go under a `filters` wrapper, false if they are flat fields. */
  filtersWrapped?: boolean;
}

export interface EntityCapabilityEntry {
  /** The single module that owns this entity's capabilities. */
  module: string;
  /** operation name → resolved op descriptor. */
  ops: Record<string, EntityCapabilityOp>;
}

export type EntityCapabilityManifest = Record<string, EntityCapabilityEntry>;

// A few entities expose capabilities from more than one module: one module owns
// the generic CRUD surface, another adds a bespoke specialized op (e.g. the
// import flow's own `tenantConnector.list` alongside `system`'s full CRUD). The
// generic grid only wants the CRUD owner, so name it here explicitly; ops from
// other modules for that entity are intentionally left out of the manifest (they
// stay reachable by their full capability key).
const ENTITY_CANONICAL_MODULE: Record<string, string> = {
  tenantConnector: "system",
};

// Ops addressed by a single record id; their input carries one id field
// (plus `patch` for update). Used to derive idParam.
const ID_ADDRESSED_OPS = new Set(["get", "update", "archive", "delete"]);

// Top-level object keys of a zod schema. Every generic-op input in the registry
// is a ZodObject (possibly via .extend), which exposes `.shape`.
function objectKeys(schema: unknown): string[] {
  const shape = (schema as { shape?: Record<string, unknown> } | null)?.shape;
  return shape && typeof shape === "object" ? Object.keys(shape) : [];
}

function deriveIdParam(operation: string, input: unknown): string | undefined {
  if (!ID_ADDRESSED_OPS.has(operation)) return undefined;
  const candidates = objectKeys(input).filter((key) => key !== "patch");
  // Unambiguous only when exactly one id-like key remains; bespoke multi-key ops
  // (e.g. a join-row delete keyed by two ids) are left unresolved on purpose.
  return candidates.length === 1 ? candidates[0] : undefined;
}

function describeOp(capability: AnyCapability): EntityCapabilityOp {
  const op: EntityCapabilityOp = { key: capability.key };
  const idParam = deriveIdParam(capability.operation, capability.input);
  if (idParam) op.idParam = idParam;
  if (capability.operation === "list") {
    op.filtersWrapped = objectKeys(capability.input).includes("filters");
  }
  return op;
}

// Builds the manifest from the live registry. Throws on the two invariants the
// dynamic-entity grid relies on: an entity must resolve to exactly one module
// (directly or via ENTITY_CANONICAL_MODULE), and an operation name must be
// unique within that entity.
export function buildEntityCapabilityManifest(
  capabilities: readonly AnyCapability[],
): EntityCapabilityManifest {
  const manifest: EntityCapabilityManifest = {};
  for (const capability of capabilities) {
    const canonicalModule = ENTITY_CANONICAL_MODULE[capability.entityName];
    if (canonicalModule && capability.module !== canonicalModule) continue;

    let entry = manifest[capability.entityName];
    if (!entry) {
      entry = { module: capability.module, ops: {} };
      manifest[capability.entityName] = entry;
    } else if (entry.module !== capability.module) {
      throw new Error(
        `entity "${capability.entityName}" is claimed by modules "${entry.module}" and ` +
          `"${capability.module}"; add it to ENTITY_CANONICAL_MODULE to pick the CRUD owner`,
      );
    }
    if (entry.ops[capability.operation]) {
      throw new Error(
        `duplicate operation "${capability.operation}" for entity "${capability.entityName}"`,
      );
    }
    entry.ops[capability.operation] = describeOp(capability);
  }
  return manifest;
}

function serializeOp(op: EntityCapabilityOp): string {
  const parts = [`key: ${JSON.stringify(op.key)}`];
  if (op.idParam !== undefined) parts.push(`idParam: ${JSON.stringify(op.idParam)}`);
  if (op.filtersWrapped !== undefined) parts.push(`filtersWrapped: ${op.filtersWrapped}`);
  return `{ ${parts.join(", ")} }`;
}

// Deterministic source rendering (entities + ops sorted) so the generated file
// is stable and the drift test can compare byte-for-byte.
export function serializeEntityCapabilityManifest(manifest: EntityCapabilityManifest): string {
  const entityNames = Object.keys(manifest).sort();
  const entries = entityNames.map((entityName) => {
    const entry = manifest[entityName];
    const ops = Object.keys(entry.ops)
      .sort()
      .map((op) => `      ${JSON.stringify(op)}: ${serializeOp(entry.ops[op])},`)
      .join("\n");
    return [
      `  ${JSON.stringify(entityName)}: {`,
      `    module: ${JSON.stringify(entry.module)},`,
      `    ops: {`,
      ops,
      `    },`,
      `  },`,
    ].join("\n");
  });

  return [
    "// AUTO-GENERATED by `pnpm run generate:manifest` (packages/db) — do not edit by hand.",
    "// Strings only: safe to import from client bundles (no handlers, no Drizzle).",
    'import type { EntityCapabilityManifest } from "./manifest-build";',
    "",
    'export type { EntityCapabilityEntry, EntityCapabilityManifest, EntityCapabilityOp } from "./manifest-build";',
    "",
    "export const entityCapabilityManifest: EntityCapabilityManifest = {",
    entries.join("\n"),
    "};",
    "",
  ].join("\n");
}
