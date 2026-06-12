import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";

import { and, eq } from "drizzle-orm";

import "../../scripts/load-env";
import { closeDb, db } from "../../index";
import {
  address,
  addressContact,
  company,
  document,
  emailAccount,
  emailAccountUserGrant,
  emailIdentity,
  emailMessage,
  emailOutbox,
  emailThread,
  organization,
  tenant,
} from "../../schema/app.schema";
import { user } from "../../schema/auth.schema";
import { EmailDocumentService } from "./document-service";

// Protect tests for the document e-mail compose/prepare path BEFORE it is
// wrapped into communication.email capabilities: they pin defaults resolution
// and the draft-outbox shape (prepare creates a draft, never sends).

async function createEmailFixture(options: { withContactEmail?: boolean } = {}) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const withContactEmail = options.withContactEmail ?? true;

  const [org] = await db
    .insert(organization)
    .values({ name: `Mail Org ${suffix}`, slug: `mail-org-${suffix}` })
    .returning({ organizationId: organization.organizationId });

  const [tenantRow] = await db
    .insert(tenant)
    .values({
      organizationId: org.organizationId,
      name: `Mail Tenant ${suffix}`,
      slug: `mail-tenant-${suffix}`,
    })
    .returning({ tenantId: tenant.tenantId });

  const userId = `mail-user-${suffix}`;
  await db.insert(user).values({
    id: userId,
    name: `Mail User ${suffix}`,
    email: `mail-user-${suffix}@example.test`,
  });

  const [companyRow] = await db
    .insert(company)
    .values({
      tenantId: tenantRow.tenantId,
      companyNo: `MAIL-${suffix}`,
      name: `Mail Company ${suffix}`,
      countryCode: "AT",
      currencyId: "EUR",
    })
    .returning({ companyId: company.companyId });

  const [customer] = await db
    .insert(address)
    .values({
      tenantId: tenantRow.tenantId,
      addressNo: `CUST-${suffix}`,
      isCustomer: true,
      companyName: `Customer GmbH ${suffix}`,
      addressLine1: `Teststraße ${suffix}`,
      postalCode: "1010",
      city: "Wien",
      countryCode: "AT",
    })
    .returning({ addressId: address.addressId });

  await db.insert(addressContact).values({
    tenantId: tenantRow.tenantId,
    addressId: customer.addressId,
    lastName: `Contact ${suffix}`,
    email: withContactEmail ? `contact-${suffix}@example.test` : null,
    isPrimary: true,
  });

  const [accountRow] = await db
    .insert(emailAccount)
    .values({
      tenantId: tenantRow.tenantId,
      provider: "gmail",
      providerAccountId: `acct-${suffix}`,
      displayName: `Mail Account ${suffix}`,
      primaryEmail: `office-${suffix}@example.test`,
      credentialsEncrypted: "test-credentials",
    })
    .returning({ emailAccountId: emailAccount.emailAccountId });

  const [identityRow] = await db
    .insert(emailIdentity)
    .values({
      tenantId: tenantRow.tenantId,
      emailAccountId: accountRow.emailAccountId,
      email: `office-${suffix}@example.test`,
      displayName: `Office ${suffix}`,
      isPrimary: true,
      canSend: true,
    })
    .returning({ emailIdentityId: emailIdentity.emailIdentityId });

  await db.insert(emailAccountUserGrant).values({
    tenantId: tenantRow.tenantId,
    emailAccountId: accountRow.emailAccountId,
    userId,
    canRead: true,
    canSend: true,
    canManage: false,
  });

  const documentId = crypto.randomUUID();
  const documentNo = `R-${suffix}`;
  await db.insert(document).values({
    documentId,
    tenantId: tenantRow.tenantId,
    companyId: companyRow.companyId,
    documentType: "R",
    documentDirection: "OUTBOUND",
    documentNo,
    status: "posted",
    documentDate: new Date().toISOString().slice(0, 10),
    customerId: customer.addressId,
    transactionId: crypto.randomUUID(),
  });

  return {
    suffix,
    tenantId: tenantRow.tenantId,
    userId,
    accountId: accountRow.emailAccountId,
    emailIdentityId: identityRow.emailIdentityId,
    documentId,
    documentNo,
    contactEmail: `contact-${suffix}@example.test`,
  };
}

test("getDocumentEmailDefaults resolves recipient, subject and pdf attachment", async () => {
  const fixture = await createEmailFixture();
  const service = new EmailDocumentService(fixture.tenantId, fixture.userId);

  const defaults = await service.getDocumentEmailDefaults({
    documentId: fixture.documentId,
    emailIdentityId: fixture.emailIdentityId,
  });

  assert.equal(defaults.accountId, fixture.accountId);
  assert.deepEqual(
    defaults.to.map((entry) => entry.email),
    [fixture.contactEmail],
  );
  assert.ok(defaults.subject.includes(fixture.documentNo));
  assert.equal(defaults.warnings.length, 0);
  assert.equal(defaults.attachments.length, 1);
  assert.equal(defaults.attachments[0].fileName, `${fixture.documentNo}.pdf`);
  assert.ok(defaults.attachments[0].storageKey?.startsWith(`tenant-${fixture.tenantId}/`));
  assert.equal(defaults.document.documentId, fixture.documentId);
});

test("getDocumentEmailDefaults warns when the customer has no email", async () => {
  const fixture = await createEmailFixture({ withContactEmail: false });
  const service = new EmailDocumentService(fixture.tenantId, fixture.userId);

  const defaults = await service.getDocumentEmailDefaults({
    documentId: fixture.documentId,
    emailIdentityId: fixture.emailIdentityId,
  });

  assert.deepEqual(defaults.to, []);
  assert.ok(defaults.warnings.length > 0);
});

test("prepareDocumentEmail creates a draft outbox entry and does not send", async () => {
  const fixture = await createEmailFixture();
  const service = new EmailDocumentService(fixture.tenantId, fixture.userId);

  const prepared = await service.prepareDocumentEmail({
    documentId: fixture.documentId,
    emailIdentityId: fixture.emailIdentityId,
  });

  assert.equal(prepared.draft.outbox.status, "draft");
  assert.equal(prepared.draft.outbox.sentAt, null);
  assert.equal(prepared.draft.outbox.emailAccountId, fixture.accountId);
  assert.equal(prepared.draft.thread.relatedDocumentId, fixture.documentId);
  assert.equal(prepared.draft.message.direction, "draft");
  assert.ok(prepared.subject.includes(fixture.documentNo));

  // The draft is tenant-scoped and re-readable through the outbox table.
  const [outboxRow] = await db
    .select()
    .from(emailOutbox)
    .where(
      and(
        eq(emailOutbox.tenantId, fixture.tenantId),
        eq(emailOutbox.emailOutboxId, prepared.draft.outbox.emailOutboxId),
      ),
    )
    .limit(1);
  assert.ok(outboxRow);
  assert.equal(outboxRow.status, "draft");

  const [threadRow] = await db
    .select()
    .from(emailThread)
    .where(eq(emailThread.emailThreadId, prepared.draft.thread.emailThreadId))
    .limit(1);
  assert.equal(threadRow.tenantId, fixture.tenantId);

  const [messageRow] = await db
    .select()
    .from(emailMessage)
    .where(eq(emailMessage.emailMessageId, prepared.draft.message.emailMessageId))
    .limit(1);
  assert.equal(messageRow.hasAttachments, true);
});

test("prepare is blocked without a send grant", async () => {
  const fixture = await createEmailFixture();
  // Different user without a grant on the account.
  const strangerId = `mail-stranger-${fixture.suffix}`;
  await db.insert(user).values({
    id: strangerId,
    name: "Stranger",
    email: `stranger-${fixture.suffix}@example.test`,
  });
  const service = new EmailDocumentService(fixture.tenantId, strangerId);

  await assert.rejects(
    service.prepareDocumentEmail({
      documentId: fixture.documentId,
      emailIdentityId: fixture.emailIdentityId,
    }),
  );
});

after(async () => {
  await closeDb();
});
