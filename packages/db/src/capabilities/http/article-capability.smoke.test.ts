import assert from "node:assert/strict";
import test from "node:test";

import { CapabilityClient } from "./capability-client";

// HTTP smoke test for the capability surface, run against the live dev server
// (`pnpm dev`). This is the canonical first test for any agent: discovery →
// descriptor → execute → read-back. Deterministic feature tests belong in
// capabilities.scenario.test.ts (in-process, throwaway tenant fixtures) —
// this file only proves the HTTP surface end to end.
//
// Run from packages/db:  pnpm exec tsx --test src/capabilities/http/*.test.ts
//
// Intentionally NOT matched by the in-process glob src/capabilities/*.test.ts,
// because it needs a running server.

// Fixed articleNo: upsert patches the existing active match on reruns, so the
// test stays idempotent and never accumulates data in the test tenant.
const ARTICLE_NO = "AI-SMOKE-001";

test("article capability smoke over HTTP", async (t) => {
  const client = await CapabilityClient.login();
  let articleId = "";

  await t.test("discovery lists masterdata.article.upsert", async () => {
    const capabilities = await client.listCapabilities({ module: "masterdata" });
    const keys = capabilities.map((c) => c.key);
    assert.ok(
      keys.includes("masterdata.article.upsert"),
      `expected masterdata.article.upsert in discovery, got: ${keys.join(", ")}`,
    );
  });

  await t.test("descriptor carries an input JSON schema", async () => {
    const descriptor = await client.getCapability("masterdata.article.upsert");
    assert.ok(descriptor, "descriptor must exist");
    assert.equal(typeof descriptor.inputSchema, "object");
  });

  await t.test("execute upsert returns an ok envelope", async () => {
    const result = await client.executeCapability<{
      article: { articleId: string; articleNo: string; name: string };
      created: boolean;
    }>("masterdata.article.upsert", { articleNo: ARTICLE_NO, name: "AI Smoke Test" });

    assert.equal(result.ok, true, `expected ok, got ${JSON.stringify(result.error)}`);
    assert.equal(result.meta?.capability, "masterdata.article.upsert");
    assert.equal(result.data?.article.articleNo, ARTICLE_NO);
    articleId = result.data!.article.articleId;
  });

  await t.test("get returns the upserted article", async () => {
    // get returns the article record directly (no { article } wrapper).
    const result = await client.executeCapability<{
      articleId: string;
      articleNo: string;
      name: string;
    }>("masterdata.article.get", { articleId });

    assert.equal(result.ok, true, `expected ok, got ${JSON.stringify(result.error)}`);
    assert.equal(result.data?.articleId, articleId);
    assert.equal(result.data?.name, "AI Smoke Test");
  });

  await t.test("validation errors map to a typed envelope", async () => {
    const result = await client.executeCapability("masterdata.article.get", {
      articleId: "not-a-uuid",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "validation");
    assert.ok(result.error?.issues?.some((i) => i.path === "articleId"));
  });
});
