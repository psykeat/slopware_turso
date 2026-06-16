import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import "../scripts/load-env";
import { closeDb } from "../index";
import { allCapabilities } from "./all";
import { executeCapability } from "./core/execute";
import { defineCapability } from "./core/define";
import { registerCapabilities } from "./core/registry";
import type { ExecutionContext } from "./core/types";
import {
  buildEntityCapabilityManifest,
  serializeEntityCapabilityManifest,
} from "./manifest-build";
import {
  capabilityIndex,
  capabilityInputJsonSchema,
  capabilityOutputJsonSchema,
  listCapabilities,
} from "./index";

const KEY_PATTERN =
  /^(masterdata|sales|logistics|accounting|communication|commerce|import|system)\.[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/;

const ctx = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  tenantId: "00000000-0000-7000-8000-000000000000",
  organizationId: "00000000-0000-7000-8000-000000000001",
  userId: null,
  actorMode: "user",
  role: "tenant_user",
  ...overrides,
});

test("registry keys are unique and canonical", () => {
  const all = listCapabilities();
  assert.ok(all.length >= 9, `expected at least 9 capabilities, got ${all.length}`);

  const seen = new Set<string>();
  for (const capability of all) {
    assert.match(capability.key, KEY_PATTERN);
    assert.equal(
      capability.key,
      `${capability.module}.${capability.entityName}.${capability.operation}`,
    );
    assert.ok(!seen.has(capability.key), `duplicate key ${capability.key}`);
    seen.add(capability.key);
  }
});

test("non-read capabilities declare writesTables", () => {
  for (const capability of listCapabilities()) {
    if (capability.kind === "read") continue;
    assert.ok(
      capability.writesTables.length > 0,
      `${capability.key} writes data but declares no writesTables`,
    );
  }
});

test("every capability converts to JSON Schema", () => {
  for (const capability of listCapabilities()) {
    const input = capabilityInputJsonSchema(capability);
    const output = capabilityOutputJsonSchema(capability);
    assert.equal(typeof input, "object");
    assert.equal(typeof output, "object");
  }
});

test("every capability rejects non-object input", () => {
  for (const capability of listCapabilities()) {
    assert.equal(
      capability.input.safeParse(42).success,
      false,
      `${capability.key} accepted a number as input`,
    );
  }
});

test("executeCapability returns unknown_capability for unknown keys", async () => {
  const result = await executeCapability("masterdata.article.doesNotExist", ctx(), {});
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "unknown_capability");
});

test("executeCapability rejects invalid input without touching the handler", async () => {
  const result = await executeCapability("masterdata.article.get", ctx(), {
    articleId: "not-a-uuid",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "validation");
    assert.ok(result.error.issues?.some((issue) => issue.path === "articleId"));
  }
});

// Test-only capabilities to exercise the gates without a database.
const gateProbe = defineCapability({
  module: "system",
  entityName: "test",
  operation: "gateProbe",
  kind: "process",
  summary: { en: "test", de: "test" },
  input: z.object({}),
  output: z.object({ ok: z.literal(true) }),
  writesTables: ["test"],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_admin",
  exposure: { llm: "hidden", http: false },
  schemaVersion: 1,
  handler: async () => ({ ok: true as const }),
});

const brokenOutputProbe = defineCapability({
  module: "system",
  entityName: "test",
  operation: "brokenOutputProbe",
  kind: "read",
  summary: { en: "test", de: "test" },
  input: z.object({}),
  output: z.object({ value: z.string() }),
  writesTables: [],
  sideEffects: [],
  idempotent: true,
  supportsDryRun: false,
  minRole: "tenant_user",
  exposure: { llm: "hidden", http: false },
  schemaVersion: 1,
  handler: async () => ({ value: 123 }) as unknown as { value: string },
});

registerCapabilities(gateProbe, brokenOutputProbe);

test("minRole gate blocks tenant_user from tenant_admin capabilities", async () => {
  const denied = await executeCapability(gateProbe.key, ctx(), {});
  assert.equal(denied.ok, false);
  assert.equal(!denied.ok && denied.error.code, "forbidden");

  const allowed = await executeCapability(gateProbe.key, ctx({ role: "tenant_admin" }), {});
  assert.equal(allowed.ok, true);
});

test("dryRun is rejected when the capability does not support it", async () => {
  const result = await executeCapability(
    gateProbe.key,
    ctx({ role: "tenant_admin", dryRun: true }),
    {},
  );
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "validation");
});

test("output contract violations surface as internal errors outside production", async () => {
  const result = await executeCapability(brokenOutputProbe.key, ctx({ actorMode: "test" }), {});
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "internal");
    assert.match(result.error.message, /output contract/);
  }
});

test("success envelope carries meta incl. invalidation hints", async () => {
  const result = await executeCapability(gateProbe.key, ctx({ role: "tenant_admin" }), {});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.meta.capability, gateProbe.key);
    assert.equal(result.meta.entityName, "test");
    assert.deepEqual(result.meta.writesTables, ["test"]);
    assert.equal(result.meta.schemaVersion, 1);
    assert.equal(result.meta.dryRun, false);
    assert.ok(result.meta.durationMs >= 0);
  }
});

test("capabilityIndex matches the registry", () => {
  // The index drives client-side type inference; it must cover exactly the
  // statically aggregated capabilities (test-only probes are not part of it).
  for (const [key, capability] of Object.entries(capabilityIndex)) {
    assert.equal(key, capability.key);
  }
  const registered = listCapabilities().filter((c) => !c.key.startsWith("system.test."));
  assert.equal(Object.keys(capabilityIndex).length, registered.length);
});

test("masterdata list capabilities expose the standard list controls", () => {
  // filterRules/orderBy/withTotal (see core/list.ts's listControlsSchema) must
  // be available on every masterdata list capability so filtering/sorting a
  // reference table is a caller-side input, not a capability code change.
  // Exempt: handlers with genuinely bespoke join/versioning logic that doesn't
  // reduce to a flat table list.
  const exempt = new Set(["articleVariantOptionValue", "articleVariantTemplate"]);
  for (const capability of listCapabilities()) {
    if (capability.module !== "masterdata" || capability.operation !== "list") continue;
    if (exempt.has(capability.entityName)) continue;
    const shape = (capability.input as unknown as { shape?: Record<string, unknown> }).shape;
    assert.ok(shape, `${capability.key} input is not a zod object`);
    for (const key of ["filterRules", "orderBy", "withTotal"]) {
      assert.ok(
        shape && key in shape,
        `${capability.key} input is missing "${key}" from the standard list controls (core/list.ts)`,
      );
    }
  }
});

test("ai projections are well-formed when present", () => {
  for (const capability of listCapabilities()) {
    const ai = capability.exposure.ai;
    if (!ai) continue;
    assert.notEqual(capability.exposure.llm, "hidden", `${capability.key} is hidden but has ai`);
    assert.ok(ai.useWhen.length > 0, `${capability.key} ai projection has empty useWhen`);
    if (ai.toolName) {
      assert.match(ai.toolName, /^[a-z]+(_[a-z][a-zA-Z0-9]*)+$/);
    }
  }
});

test("ai tool names are unique across the projected set", () => {
  // The tool generator (packages/agent) keys tools by this name, so a collision
  // would silently drop a capability from the LLM toolset. Mirror the default
  // naming used there: ai.toolName ?? `${module}_${operation}_${entityName}`.
  const byToolName = new Map<string, string>();
  for (const capability of listCapabilities()) {
    const ai = capability.exposure.ai;
    if (!ai) continue;
    const toolName = ai.toolName ?? `${capability.module}_${capability.operation}_${capability.entityName}`;
    const existing = byToolName.get(toolName);
    assert.ok(!existing, `tool name "${toolName}" is shared by ${existing} and ${capability.key}`);
    byToolName.set(toolName, capability.key);
  }
});

test("entity capability manifest is in sync with the registry", () => {
  // The generated manifest is imported by client bundles, so it must never
  // drift from the registry. Regenerate in-memory and compare byte-for-byte;
  // run `pnpm run generate:manifest` (packages/db) if this fails.
  const expected = serializeEntityCapabilityManifest(
    buildEntityCapabilityManifest(allCapabilities),
  );
  const actualPath = fileURLToPath(new URL("./manifest.generated.ts", import.meta.url));
  const actual = readFileSync(actualPath, "utf8");
  assert.equal(actual, expected, "manifest.generated.ts is stale — run pnpm run generate:manifest");
});

after(async () => {
  await closeDb();
});
