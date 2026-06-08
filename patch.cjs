const fs = require("fs");
const file = "packages/db/src/services/email/sync-service.ts";
let code = fs.readFileSync(file, "utf8");

code = code.replace("  addressContact,", "  addressContact,\n  addressContactIdentity,");

const func = `
  async syncContactsForAccount(accountId: string) {
    const [account] = await db
      .select({
        emailAccountId: emailAccount.emailAccountId,
        provider: emailAccount.provider,
        credentialsEncrypted: emailAccount.credentialsEncrypted,
      })
      .from(emailAccount)
      .where(
        and(eq(emailAccount.tenantId, this.tenantId), eq(emailAccount.emailAccountId, accountId)),
      )
      .limit(1);
    if (!account) throw new Error("Account not found");

    const adapter = createEmailProviderAdapter(account.provider as any);
    const contacts = await adapter.syncContacts(account.credentialsEncrypted);
    await this.persistUpdatedCredentials(account.emailAccountId, adapter);

    for (const contact of contacts) {
      if (!contact.email) continue;
      const normalizedEmail = contact.email.toLowerCase();

      await db.transaction(async (tx) => {
        const [existingIdentity] = await tx
          .select({
            identityId: addressContactIdentity.identityId,
            contactId: addressContactIdentity.contactId,
          })
          .from(addressContactIdentity)
          .where(
            and(
              eq(addressContactIdentity.tenantId, this.tenantId),
              eq(addressContactIdentity.normalizedValue, normalizedEmail),
            ),
          )
          .limit(1);

        if (existingIdentity) {
          await tx
            .update(addressContactIdentity)
            .set({
              value: contact.email,
              sourceObjectId: contact.id,
              sourceAccountId: accountId,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(addressContactIdentity.tenantId, this.tenantId),
                eq(addressContactIdentity.identityId, existingIdentity.identityId),
              ),
            );
          return;
        }

        const [existingContact] = await tx
          .select({ contactId: addressContact.contactId })
          .from(addressContact)
          .where(
            and(
              eq(addressContact.tenantId, this.tenantId),
              sql\`lower(\${addressContact.email}) = \${normalizedEmail}\`,
            ),
          )
          .limit(1);

        let contactId = existingContact?.contactId;

        if (!contactId) {
          const [newContact] = await tx
            .insert(addressContact)
            .values({
              tenantId: this.tenantId,
              email: contact.email,
              firstName: contact.firstName,
              lastName: contact.lastName || contact.displayName || contact.email.split("@")[0] || "Unknown",
              displayName: contact.displayName,
              isPrimary: false,
              archived: false,
            })
            .returning({ contactId: addressContact.contactId });
          if (!newContact) return;
          contactId = newContact.contactId;
        }

        await tx.insert(addressContactIdentity).values({
          tenantId: this.tenantId,
          contactId: contactId,
          sourceSystem: account.provider,
          sourceAccountId: accountId,
          sourceObjectId: contact.id,
          identityType: "email",
          value: contact.email,
          normalizedValue: normalizedEmail,
          isPrimary: false,
          isVerified: true,
        });
      });
    }
  }
`;

code = code.replace(
  "  async trashThread(threadId: string) {",
  func + "\n  async trashThread(threadId: string) {",
);
fs.writeFileSync(file, code);
