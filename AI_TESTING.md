# AI_TESTING — Capability API Quickstart for Agents

Operations manual for testing this platform. Read this INSTEAD of building
infrastructure. Full spec: `.agents/07_api.md` (only if you need details).

## Hard rules (non-negotiable)

- For all read/write tests, use **only** the capability surface below — over
  HTTP or in-process via `executeCapability`.
- **Never** build auth bypasses, mock servers, or new routes for existing
  capabilities. **Never** access services or the DB directly in HTTP tests.
- **Never** put `tenantId` in any capability input. The server builds tenant
  context from the session — inputs containing `tenantId` are a bug.
- Unsure which capabilities exist? Call discovery **first**.
- Capability missing for what you need? **Stop and report the gap.** Do not
  program a substitute path.

## The only allowed endpoints

```
GET  /api/capabilities?module=&entityName=     discovery (self-describing, JSON Schema)
GET  /api/capabilities/{key}                   one descriptor incl. outputSchema
POST /api/capabilities/{key}/execute           {"input":{...},"dryRun":false}
POST /api/ai/execute                           AI orchestrator: prompt|messages → capability tool loop
```

Envelope: `{ok:true,data,meta}` or `{ok:false,error:{code,message,issues?}}`.
HTTP status mirrors `error.code`: 422 validation · 403 forbidden · 404
not_found/unknown · 409 conflict · 500 internal.

**Idempotency**: send an `Idempotency-Key` header (or `idempotencyKey` in the
body) to `/execute`. A repeated key replays the stored result of the first
successful write (`meta.replayed:true`); reusing it with a different payload is
a 409. Reads ignore it.

**AI execute**: `POST /api/ai/execute` runs the model over the AI-projected
capability toolset (`buildCapabilityTools`) — the model never sees raw services
or a `tenantId`. Body: `{prompt|messages, group?, keys?, confirmMode?, stream?}`.
Confirm-gated capabilities (post/storno/delete/send) are excluded unless you opt
in with `confirmMode`. This is a curated projection, not a substitute path.

## Auth for tests

A dedicated test user exists with its own isolated tenant (no base-tenant
data is touched). Credentials live in `apps/web/.env`:

```
CAPABILITY_TEST_EMAIL / CAPABILITY_TEST_PASSWORD
```

`CapabilityClient.login()` handles sign-in and cookies — you never write
auth code yourself. Requires the dev server: `pnpm dev` (port 3000).

This user's tenant stays deliberately isolated and empty — it exists so write
tests can never touch base-tenant data. For anything that needs the rich,
`db:seed:full`-populated **base** tenant instead (manual HTTP calls, a
browser session, eyeballing a capability before writing a test), use
`pnpm db:dev-login` below rather than pointing `CapabilityClient.login()` at
this user.

## Ad-hoc dev/agent login (base tenant)

```bash
pnpm db:dev-login
```

Signs in as the dedicated E2E user (`e2e@slopware.test`, created if needed),
links it to the base tenant if it isn't already, and prints the session
cookie. Requires the dev server: `pnpm dev` (port 3000). Use it to:

- run manual `curl` calls against `/api/...` with a real session,
- paste the cookie into a browser's devtools for manual UI testing,
- or check a capability's behavior against real base-tenant data without
  writing a test file first.

```bash
$ pnpm db:dev-login
Signed in as e2e@slopware.test, bound to the base tenant.
curl -H 'cookie: better-auth.session_token=...' http://localhost:3000/api/me
(Or paste the cookie below into your browser's devtools for manual UI testing.)
better-auth.session_token=...
```

The same user backs the Playwright E2E suite (`apps/web/e2e/setup/auth.setup.ts`)
— it's also bound to the base tenant there, so this is the same identity, not
a new mechanism.

## The client (use it, don't rebuild it)

`packages/db/src/capabilities/http/capability-client.ts`

```ts
import { CapabilityClient } from "./capability-client";

const client = await CapabilityClient.login();
const caps = await client.listCapabilities({ module: "masterdata" });
const descriptor = await client.getCapability("masterdata.article.upsert");
const result = await client.executeCapability("masterdata.article.upsert", {
  articleNo: "AI-TEST-001",
  name: "Test article",
});
// result.ok === true, result.data.article.articleId, result.meta.capability
```

`masterdata.article.upsert` matches on the natural key `articleNo`: active
match → patch, none → create (`name` required), archived match → 409. Safe to
retry. `masterdata.article.get` returns the record directly (no wrapper).

## Minimal test (the template)

`packages/db/src/capabilities/http/article-capability.smoke.test.ts` is the
canonical example: discovery → descriptor → execute → read-back → typed
validation error. Copy its shape for new HTTP tests:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { CapabilityClient } from "./capability-client";

test("my capability over HTTP", async () => {
  const client = await CapabilityClient.login();
  const result = await client.executeCapability("masterdata.article.upsert", {
    articleNo: "AI-TEST-002",
    name: "My test",
  });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.meta?.capability, "masterdata.article.upsert");
});
```

Run from `packages/db`:

```
pnpm exec tsx --test src/capabilities/http/*.test.ts
```

## Which test layer to use

- **HTTP smoke** (this file's subject): proves the surface end to end against
  the live dev server. Use for "does the API work" checks.
- **In-process scenario** (`capabilities.scenario.test.ts`): deterministic
  feature tests. Use `getContextForTenant(tenantSlugOrId)` from `fixtures.ts` to
  obtain a real ExecutionContext for existing tenants (e.g. `"base"`), or use
  `useTestTenant()` for a throwaway sandbox tenant. Call `executeCapability` directly
  — no HTTP, no login. Run:
  `pnpm exec tsx --test src/capabilities/*.test.ts`

  **Test Seeding**: For complex, multi-entity setups (e.g., articles with variants, stock levels, and document headers/lines), use the fluent `TestScenarioBuilder` defined in [fixtures.ts](file:///home/ubuntu/slopware/packages/db/src/test-support/fixtures.ts) instead of writing raw table inserts:
  ```ts
  const scenario = await new TestScenarioBuilder()
    .withTenant() // uses useTestTenant() internally if no tenantSlugOrId is passed
    .withArticle({ articleNo: "ART-01", name: "Laptop" })
    .withVariant({ sku: "LAP-8GB", stock: 10 })
    .withDocument({ type: "order", lineItems: [{ sku: "LAP-8GB", qty: 2 }] })
    .build();
  // scenario.tenantId, scenario.articleId, scenario.variantId, scenario.documentId, etc., are immediately available
  ```

## Local CLI Capability Runner

To test capability logic manually without setting up testing files or server sessions, run the execution script directly from the workspace root:

```bash
pnpm db:execute <capabilityKey> <tenantSlugOrId> '<jsonInput>' [--dry-run]
```

Example:
```bash
pnpm db:execute masterdata.article.list base '{"limit":2}'
```

## Full Feature Database Seeding

To populate the base tenant (`"base"`) with a comprehensive set of real-world master data, variants, chart of accounts (SKR03), taxes, and sample sales documents (draft and posted orders/invoices), run:

```bash
pnpm db:seed:full
```

This runs the baseline seeds and then uses the application's capabilities to dynamically establish a complete and consistent state.


## Current capability keys (v1)

`masterdata.article.{get,list,upsert,archive}` ·
`masterdata.articleVariantTemplate.{list,get,create,update,applyToArticle}`

Discovery is the source of truth — this list goes stale; the API does not.
