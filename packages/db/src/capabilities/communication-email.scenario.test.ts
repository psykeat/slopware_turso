import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import "../scripts/load-env";
import { closeDb, db } from "../index";
import {
  address,
  emailAccount,
  emailAccountUserGrant,
  emailIdentity,
  emailThread,
  organization,
  tenant,
} from "../schema/app.schema";
import { user } from "../schema/auth.schema";
import { executeCapability, type ExecutionContext } from "./index";

// Scenario coverage for the DB-pure communication.email capabilities.
// Provider-bound operations (archive/markRead/confirmSend) are exercised at
// the service layer; their capability wrappers add no extra logic.

async function createCommunicationFixture() {
  const suffix = crypto.randomUUID().slice(0, 8);

  const [org] = await db
    .insert(organization)
    .values({ name: `Comm Org ${suffix}`, slug: `comm-org-${suffix}` })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Comm Tenant ${suffix}`,
      slug: `comm-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const userId = `comm-user-${suffix}`;
  await db.insert(user).values({
    id: userId,
    name: `Comm User ${suffix}`,
    email: `comm-user-${suffix}@example.test`,
  });

  const [accountRow] = await db
    .insert(emailAccount)
    .values({
      tenantId: tenantRow.tenantId,
      provider: "gmail",
      providerAccountId: `acct-${suffix}`,
      displayName: `Comm Account ${suffix}`,
      primaryEmail: `comm-${suffix}@example.test`,
      credentialsEncrypted: "test-credentials",
    })
    .returning({ emailAccountId: emailAccount.emailAccountId });

  await db.insert(emailIdentity).values({
    tenantId: tenantRow.tenantId,
    emailAccountId: accountRow.emailAccountId,
    email: `comm-${suffix}@example.test`,
    isPrimary: true,
    canSend: true,
  });

  await db.insert(emailAccountUserGrant).values({
    tenantId: tenantRow.tenantId,
    emailAccountId: accountRow.emailAccountId,
    userId,
    canRead: true,
    canSend: true,
  });

  const [threadRow] = await db
    .insert(emailThread)
    .values({
      tenantId: tenantRow.tenantId,
      emailAccountId: accountRow.emailAccountId,
      providerThreadId: `thread-${suffix}`,
      subject: `Comm Thread ${suffix}`,
      lastMessageAt: new Date(),
      isRead: false,
      messageCount: 0,
    })
    .returning({ emailThreadId: emailThread.emailThreadId });

  const [customer] = await db
    .insert(address)
    .values({
      tenantId: tenantRow.tenantId,
      addressNo: `COMM-${suffix}`,
      isCustomer: true,
      companyName: `Comm Customer ${suffix}`,
      addressLine1: `Teststraße ${suffix}`,
      postalCode: "1010",
      city: "Wien",
      countryCode: "AT",
    })
    .returning({ addressId: address.addressId });

  const ctx: ExecutionContext = {
    tenantId: tenantRow.tenantId,
    organizationId: org.organizationId,
    userId,
    actorMode: "test",
    role: "system",
  };

  return {
    ctx,
    suffix,
    accountId: accountRow.emailAccountId,
    threadId: threadRow.emailThreadId,
    addressId: customer.addressId,
  };
}

function expectOk<T>(result: { ok: true; data: T } | { ok: false; error: unknown }): T {
  assert.equal(result.ok, true, `expected ok envelope, got ${JSON.stringify(result)}`);
  return (result as { ok: true; data: T }).data;
}

test("email thread list/get/link through the capability surface", async () => {
  const fixture = await createCommunicationFixture();
  const { ctx } = fixture;

  const accounts = expectOk<{ items: Array<{ emailAccountId: string }> }>(
    await executeCapability("communication.emailAccount.list", ctx, {}),
  );
  assert.ok(accounts.items.some((item) => item.emailAccountId === fixture.accountId));

  const listed = expectOk<Array<unknown> | { items: Array<{ emailThreadId: string }> }>(
    await executeCapability("communication.emailThread.list", ctx, {}),
  ) as { items: Array<{ emailThreadId: string }> };
  assert.ok(listed.items.some((item) => item.emailThreadId === fixture.threadId));

  const thread = expectOk<{ emailThreadId?: string; messages?: unknown[] }>(
    await executeCapability("communication.emailThread.get", ctx, {
      threadId: fixture.threadId,
    }),
  );
  assert.equal(thread.emailThreadId, fixture.threadId);

  const linked = expectOk<{ relatedAddressId?: string | null }>(
    await executeCapability("communication.emailThread.link", ctx, {
      threadId: fixture.threadId,
      addressId: fixture.addressId,
    }),
  );
  assert.equal(linked.relatedAddressId, fixture.addressId);

  const unlinked = expectOk<{ relatedAddressId?: string | null }>(
    await executeCapability("communication.emailThread.link", ctx, {
      threadId: fixture.threadId,
      addressId: null,
    }),
  );
  assert.equal(unlinked.relatedAddressId, null);

  // Link without any target field must fail validation.
  const invalid = await executeCapability("communication.emailThread.link", ctx, {
    threadId: fixture.threadId,
  });
  assert.equal(invalid.ok, false);
  assert.equal(!invalid.ok && invalid.error.code, "validation");
});

test("email threads are tenant-isolated through capabilities", async () => {
  const [a, b] = await Promise.all([createCommunicationFixture(), createCommunicationFixture()]);

  const foreign = await executeCapability("communication.emailThread.get", b.ctx, {
    threadId: a.threadId,
  });
  assert.equal(foreign.ok, false);
  assert.equal(!foreign.ok && foreign.error.code, "not_found");

  const foreignLink = await executeCapability("communication.emailThread.link", b.ctx, {
    threadId: a.threadId,
    addressId: b.addressId,
  });
  assert.equal(foreignLink.ok, false);
});

test("import batch capabilities map missing batches to not_found", async () => {
  const fixture = await createCommunicationFixture();

  const approve = await executeCapability("import.importBatch.approve", fixture.ctx, {
    batchId: crypto.randomUUID(),
  });
  assert.equal(approve.ok, false);
  assert.equal(!approve.ok && approve.error.code, "not_found");

  const post = await executeCapability("import.importBatch.post", fixture.ctx, {
    batchId: crypto.randomUUID(),
  });
  assert.equal(post.ok, false);
  assert.equal(!post.ok && post.error.code, "not_found");
});

after(async () => {
  await closeDb();
});
