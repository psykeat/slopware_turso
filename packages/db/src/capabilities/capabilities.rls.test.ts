import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after, before } from "node:test";

import { eq, inArray, sql } from "drizzle-orm";

import "../scripts/load-env";
import { closeDb, db, runWithDbTx } from "../index";
import { address, organization, tenant } from "../schema/app.schema";
import { executeCapability, type ExecutionContext } from "./index";

// These tests prove the RLS pilot enforces tenant isolation at the database
// level for the app_runtime role, independent of the application-level scoping.
// The app's own connection (owner) keeps bypassing RLS (ENABLE, not FORCE).

const tenantIds: string[] = [];
const addressIds: string[] = [];

function ownerCtx(tenantId: string, organizationId: string): ExecutionContext {
  return { tenantId, organizationId, userId: null, actorMode: "test", role: "system" };
}

async function createTenantWithAddress(tag: string) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [org] = await db
    .insert(organization)
    .values({ name: `RLS Org ${tag} ${suffix}`, slug: `rls-org-${tag}-${suffix}` })
    .returning({ organizationId: organization.organizationId });
  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `RLS Tenant ${tag} ${suffix}`,
      slug: `rls-tenant-${tag}-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });
  tenantIds.push(tenantRow.tenantId);

  // Created via the capability (owner connection, RLS bypassed) so the row is valid.
  const result = await executeCapability(
    "masterdata.address.upsert",
    ownerCtx(tenantRow.tenantId, org.organizationId),
    {
      addressNo: `RLS-${tag}-${suffix}`,
      companyName: `RLS ${tag}`,
      addressLine1: "Teststr. 1",
      postalCode: "1010",
      city: "Wien",
      countryCode: "AT",
    },
  );
  assert.equal(result.ok, true, `address upsert failed: ${JSON.stringify(result)}`);
  const addressId = (result as { ok: true; data: { address: { addressId: string } } }).data.address
    .addressId;
  addressIds.push(addressId);
  return { tenantId: tenantRow.tenantId, addressId };
}

let tenantA = { tenantId: "", addressId: "" };
let tenantB = { tenantId: "", addressId: "" };

before(async () => {
  tenantA = await createTenantWithAddress("a");
  tenantB = await createTenantWithAddress("b");
});

// Run a block as the scoped app_runtime role with a transaction-local tenant GUC.
async function asRuntime<T>(
  tenantId: string | null,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role app_runtime`);
    if (tenantId) {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    }
    return fn(tx);
  });
}

async function visibleIds(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string[]> {
  const rows = (await tx.execute(
    sql`select address_id from "address" where address_id in (${tenantA.addressId}, ${tenantB.addressId})`,
  )) as unknown as Array<{ address_id: string }>;
  return rows.map((r) => r.address_id);
}

test("app_runtime sees only its own tenant's rows", async () => {
  const seenByA = await asRuntime(tenantA.tenantId, visibleIds);
  assert.deepEqual(seenByA, [tenantA.addressId]);

  const seenByB = await asRuntime(tenantB.tenantId, visibleIds);
  assert.deepEqual(seenByB, [tenantB.addressId]);
});

test("app_runtime with no tenant GUC sees nothing", async () => {
  const seen = await asRuntime(null, visibleIds);
  assert.deepEqual(seen, []);
});

test("WITH CHECK blocks moving a row to another tenant", async () => {
  await assert.rejects(
    asRuntime(tenantA.tenantId, async (tx) => {
      await tx.execute(
        sql`update "address" set tenant_id = ${tenantB.tenantId} where address_id = ${tenantA.addressId}`,
      );
    }),
    (err: unknown) => {
      // drizzle wraps the PostgresError; the RLS text is on the cause chain.
      const text = `${(err as Error).message} ${String((err as { cause?: { message?: string } }).cause?.message ?? "")}`;
      return /row-level security/i.test(text);
    },
  );
});

test("the owner connection bypasses RLS (app is unaffected)", async () => {
  const rows = (await db.execute(
    sql`select address_id from "address" where address_id in (${tenantA.addressId}, ${tenantB.addressId})`,
  )) as unknown as Array<{ address_id: string }>;
  assert.equal(rows.length, 2, "owner must see both tenants' rows");
});

test("the db proxy routes the global db onto the active tenant transaction", async () => {
  // Proves the plumbing the runtime relies on: inside runWithDbTx the global
  // `db` resolves the transaction-local GUC, not the base connection's.
  const value = await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantA.tenantId}, true)`);
    return runWithDbTx(tx, async () => {
      const rows = (await db.execute(
        sql`select current_setting('app.tenant_id', true) as t`,
      )) as unknown as Array<{ t: string }>;
      return rows[0]?.t;
    });
  });
  assert.equal(value, tenantA.tenantId);
});

after(async () => {
  if (addressIds.length) {
    await db.delete(address).where(inArray(address.addressId, addressIds));
  }
  for (const tenantId of tenantIds) {
    await db.delete(tenant).where(eq(tenant.tenantId, tenantId));
  }
  await closeDb();
});
