import { and, eq, sql } from "drizzle-orm";

import { db } from "../../index";
import { emailAccount, emailAccountUserGrant, emailIdentity } from "../../schema/app.schema";
import { createEmailProviderAdapter } from "./adapters";
import type { EmailProvider } from "./types";

export class EmailAuthorizationError extends Error {
  constructor(message = "Email account access denied") {
    super(message);
    this.name = "EmailAuthorizationError";
  }
}

export class EmailAccountService {
  constructor(
    private tenantId: string,
    private userId: string,
  ) {}

  async listAccounts() {
    return await db
      .select({
        emailAccountId: emailAccount.emailAccountId,
        provider: emailAccount.provider,
        displayName: emailAccount.displayName,
        primaryEmail: emailAccount.primaryEmail,
        status: emailAccount.status,
        lastSyncAt: emailAccount.lastSyncAt,
        lastSyncStatus: emailAccount.lastSyncStatus,
        watchExpiresAt: emailAccount.watchExpiresAt,
      })
      .from(emailAccount)
      .innerJoin(
        emailAccountUserGrant,
        and(
          eq(emailAccountUserGrant.emailAccountId, emailAccount.emailAccountId),
          eq(emailAccountUserGrant.tenantId, this.tenantId),
          eq(emailAccountUserGrant.userId, this.userId),
          eq(emailAccountUserGrant.canRead, true),
        ),
      )
      .where(and(eq(emailAccount.tenantId, this.tenantId), eq(emailAccount.archived, false)));
  }

  async listIdentities(accountId: string) {
    await this.assertGrant(accountId, "read");
    return await db
      .select()
      .from(emailIdentity)
      .where(
        and(
          eq(emailIdentity.tenantId, this.tenantId),
          eq(emailIdentity.emailAccountId, accountId),
          eq(emailIdentity.archived, false),
        ),
      );
  }

  async connect(provider: EmailProvider, input: Record<string, unknown>) {
    const adapter = createEmailProviderAdapter(provider);
    const connected = await adapter.connect(input);

    return await db.transaction(async (tx) => {
      const [account] = await tx
        .insert(emailAccount)
        .values({
          tenantId: this.tenantId,
          provider: connected.provider,
          providerAccountId: connected.providerAccountId,
          displayName: connected.displayName,
          primaryEmail: connected.primaryEmail,
          credentialsEncrypted: connected.encryptedCredentials,
          scopes: connected.scopes,
          status: "connected",
          lastSyncStatus: "idle",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [emailAccount.tenantId, emailAccount.provider, emailAccount.providerAccountId],
          set: {
            displayName: connected.displayName,
            primaryEmail: connected.primaryEmail,
            credentialsEncrypted: connected.encryptedCredentials,
            scopes: connected.scopes,
            status: "connected",
            archived: false,
            updatedAt: new Date(),
          },
        })
        .returning();

      await tx
        .insert(emailAccountUserGrant)
        .values({
          tenantId: this.tenantId,
          emailAccountId: account.emailAccountId,
          userId: this.userId,
          canRead: true,
          canSend: true,
          canManage: true,
        })
        .onConflictDoUpdate({
          target: [
            emailAccountUserGrant.tenantId,
            emailAccountUserGrant.emailAccountId,
            emailAccountUserGrant.userId,
          ],
          set: { canRead: true, canSend: true, canManage: true },
        });

      for (const identity of connected.identities ?? [
        {
          email: connected.primaryEmail,
          displayName: connected.displayName,
          isPrimary: true,
          canSend: true,
        },
      ]) {
        await tx
          .insert(emailIdentity)
          .values({
            tenantId: this.tenantId,
            emailAccountId: account.emailAccountId,
            email: identity.email,
            displayName: identity.displayName,
            providerIdentityId: identity.providerIdentityId,
            isPrimary: Boolean(identity.isPrimary),
            canSend: identity.canSend ?? true,
          })
          .onConflictDoUpdate({
            target: [emailIdentity.tenantId, emailIdentity.emailAccountId, emailIdentity.email],
            set: {
              displayName: identity.displayName,
              providerIdentityId: identity.providerIdentityId,
              isPrimary: Boolean(identity.isPrimary),
              canSend: identity.canSend ?? true,
              archived: false,
            },
          });
      }

      return account;
    });
  }

  async assertGrant(accountId: string, capability: "read" | "send" | "manage") {
    if (this.userId === "system") return;
    const column =
      capability === "read"
        ? emailAccountUserGrant.canRead
        : capability === "send"
          ? emailAccountUserGrant.canSend
          : emailAccountUserGrant.canManage;

    const rows = await db
      .select({ ok: sql`1` })
      .from(emailAccountUserGrant)
      .where(
        and(
          eq(emailAccountUserGrant.tenantId, this.tenantId),
          eq(emailAccountUserGrant.emailAccountId, accountId),
          eq(emailAccountUserGrant.userId, this.userId),
          eq(column, true),
        ),
      )
      .limit(1);

    if (!rows[0]) throw new EmailAuthorizationError();
  }

  async getAccountForProvider(accountId: string, capability: "read" | "send" | "manage" = "read") {
    await this.assertGrant(accountId, capability);
    const rows = await db
      .select()
      .from(emailAccount)
      .where(
        and(
          eq(emailAccount.tenantId, this.tenantId),
          eq(emailAccount.emailAccountId, accountId),
          eq(emailAccount.archived, false),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
}
