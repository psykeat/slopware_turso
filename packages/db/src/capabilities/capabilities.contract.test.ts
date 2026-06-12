import assert from "node:assert/strict";
import test, { after } from "node:test";

import { z } from "zod";

import "../scripts/load-env";
import { closeDb } from "../index";
import { executeCapability } from "./core/execute";
import { defineCapability } from "./core/define";
import { registerCapabilities } from "./core/registry";
import type { ExecutionContext } from "./core/types";
import {
  capabilityInputJsonSchema,
  capabilityOutputJsonSchema,
  listCapabilities,
} from "./index";

const KEY_PATTERN =
  /^(masterdata|sales|logistics|accounting|system)\.[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*$/;

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

test("success envelope carries meta", async () => {
  const result = await executeCapability(gateProbe.key, ctx({ role: "tenant_admin" }), {});
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.meta.capability, gateProbe.key);
    assert.equal(result.meta.schemaVersion, 1);
    assert.equal(result.meta.dryRun, false);
    assert.ok(result.meta.durationMs >= 0);
  }
});

after(async () => {
  await closeDb();
});
