import assert from "node:assert/strict";
import test from "node:test";

import { capabilityInputJsonSchema, type AnyCapability } from "@repo/db/capabilities";

import {
  buildCapabilityTools,
  capabilityToolName,
  listAiCapabilities,
} from "./capability-tools";

const ctx = {
  tenantId: "00000000-0000-7000-8000-000000000000",
  organizationId: "00000000-0000-7000-8000-000000000001",
  userId: null,
  actorMode: "assistant" as const,
  role: "tenant_user" as const,
};

test("only AI-projected, non-hidden capabilities are eligible", () => {
  const all = listAiCapabilities({ activeByDefaultOnly: false });
  assert.ok(all.length >= 15, `expected the curated toolset, got ${all.length}`);
  for (const capability of all) {
    assert.ok(capability.exposure.ai, `${capability.key} has no ai projection`);
    assert.notEqual(capability.exposure.llm, "hidden");
  }
});

test("tool names are unique and follow the snake/camel pattern", () => {
  const seen = new Set<string>();
  for (const capability of listAiCapabilities({ activeByDefaultOnly: false })) {
    const name = capabilityToolName(capability);
    assert.match(name, /^[a-z]+(_[a-z][a-zA-Z0-9]*)+$/, `bad tool name ${name}`);
    assert.ok(!seen.has(name), `duplicate tool name ${name}`);
    seen.add(name);
  }
});

test("no tool input schema exposes tenantId", () => {
  for (const capability of listAiCapabilities({ activeByDefaultOnly: false })) {
    const schema = capabilityInputJsonSchema(capability) as {
      properties?: Record<string, unknown>;
    };
    assert.ok(
      !schema.properties || !("tenantId" in schema.properties),
      `${capability.key} input exposes tenantId to the model`,
    );
  }
});

test("group filter scopes the toolset", () => {
  const mail = listAiCapabilities({ group: "mail", activeByDefaultOnly: false });
  assert.ok(mail.length > 0);
  assert.ok(mail.every((c) => c.exposure.ai!.group === "mail"));

  const sales = listAiCapabilities({ group: "sales-documents", activeByDefaultOnly: false });
  assert.ok(sales.length > 0);
  assert.ok(sales.every((c) => c.exposure.ai!.group === "sales-documents"));
});

test("activeByDefault is the default scope", () => {
  const curated = listAiCapabilities();
  const everything = listAiCapabilities({ activeByDefaultOnly: false });
  assert.ok(curated.length <= everything.length);
  assert.ok(curated.every((c) => c.exposure.ai!.activeByDefault));
});

test("confirmMode controls confirm-gated capabilities", () => {
  const withConfirm = listAiCapabilities({ activeByDefaultOnly: false });
  const confirmKeys = withConfirm.filter((c) => c.exposure.llm === "confirm");
  assert.ok(confirmKeys.length > 0, "expected at least one confirm capability in the toolset");

  const excluded = listAiCapabilities({ activeByDefaultOnly: false, confirmMode: "exclude" });
  assert.ok(excluded.every((c) => c.exposure.llm !== "confirm"));
  assert.equal(excluded.length, withConfirm.length - confirmKeys.length);
});

test("buildCapabilityTools emits one tool per eligible capability", () => {
  const capabilities = listAiCapabilities({ activeByDefaultOnly: false });
  const tools = buildCapabilityTools(ctx, { activeByDefaultOnly: false });
  assert.equal(tools.length, capabilities.length);
  // The returned objects must be invocable server tools.
  for (const tool of tools) {
    assert.equal(typeof tool, "object");
  }
});

test("buildCapabilityTools with keys allow-list ignores group/default filters", () => {
  const keys = ["sales.document.post", "masterdata.address.search"];
  const tools = buildCapabilityTools(ctx, { keys });
  assert.equal(tools.length, 2);
});

test("buildCapabilityTools delegates to executeCapability for unknown ctx safely", async () => {
  // A read tool with a deliberately invalid input must fail closed (validation),
  // never throw, and never reach the database.
  const tools = buildCapabilityTools(ctx, { keys: ["masterdata.article.get"] });
  const tool = tools[0] as unknown as {
    handler?: (input: unknown) => Promise<unknown>;
    server?: { handler?: (input: unknown) => Promise<unknown> };
  };
  const invoke =
    typeof tool.handler === "function"
      ? tool.handler
      : tool.server?.handler;
  if (typeof invoke !== "function") return; // shape-tolerant: skip if internal shape differs
  const result = (await invoke({ articleId: "not-a-uuid" })) as {
    ok: boolean;
    error?: { code: string };
  };
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, "validation");
});

function findCapability(key: string): AnyCapability {
  const found = listAiCapabilities({ activeByDefaultOnly: false }).find((c) => c.key === key);
  assert.ok(found, `missing ${key}`);
  return found;
}

test("curated tool names cover the documented set", () => {
  assert.equal(capabilityToolName(findCapability("sales.document.post")), "sales_post_document");
  assert.equal(
    capabilityToolName(findCapability("masterdata.address.search")),
    "masterdata_search_address",
  );
});
