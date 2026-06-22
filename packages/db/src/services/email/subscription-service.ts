import { and, eq, isNotNull, lt, or, sql } from "drizzle-orm";

import { db } from "../../index";
import { emailAccount, emailSubscription } from "../../schema/sqlite.schema";

// How many hours before expiry to trigger renewal, per provider and resource.
// Based on Graph's published max durations (messages/events: ~4230min / ~3 days;
// Gmail Watch: 7 days). We renew when less than leadHours remain.
const RENEWAL_LEAD_HOURS: Record<string, Record<string, number>> = {
  gmail: { mail: 48, calendar: 48, contacts: 48 },
  microsoft: { mail: 24, calendar: 12, contacts: 12 },
};

export class EmailSubscriptionService {
  constructor(private tenantId: string) {}

  async registerSubscription(input: {
    emailAccountId: string;
    resource: "mail" | "calendar" | "contacts";
    providerSubscriptionId?: string | null;
    channelToken?: string | null;
    expiresAt?: Date | null;
  }) {
    const now = new Date();
    const [row] = await db
      .insert(emailSubscription)
      .values({
        tenantId: this.tenantId,
        emailAccountId: input.emailAccountId,
        resource: input.resource,
        providerSubscriptionId: input.providerSubscriptionId ?? null,
        channelToken: input.channelToken ?? null,
        expiresAt: input.expiresAt ?? null,
        renewedAt: now,
        status: "active",
        renewalAttempts: 0,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          emailSubscription.tenantId,
          emailSubscription.emailAccountId,
          emailSubscription.resource,
        ],
        set: {
          providerSubscriptionId: input.providerSubscriptionId ?? null,
          channelToken: input.channelToken ?? null,
          expiresAt: input.expiresAt ?? null,
          renewedAt: now,
          status: "active",
          renewalAttempts: 0,
          updatedAt: now,
        },
      })
      .returning();
    return row;
  }

  async markRenewalPending(emailAccountId: string, resource = "mail") {
    const now = new Date();
    await db
      .update(emailSubscription)
      .set({ status: "renewal_pending", updatedAt: now })
      .where(
        and(
          eq(emailSubscription.emailAccountId, emailAccountId),
          eq(emailSubscription.resource, resource),
        ),
      );
  }

  async markRenewalFailed(emailAccountId: string, resource = "mail") {
    const now = new Date();
    await db
      .update(emailSubscription)
      .set({
        status: "failed",
        renewalAttempts: sql`${emailSubscription.renewalAttempts} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(emailSubscription.emailAccountId, emailAccountId),
          eq(emailSubscription.resource, resource),
        ),
      );
  }

  async getByChannelToken(channelToken: string) {
    const [row] = await db
      .select({
        emailSubscriptionId: emailSubscription.emailSubscriptionId,
        tenantId: emailSubscription.tenantId,
        emailAccountId: emailSubscription.emailAccountId,
        resource: emailSubscription.resource,
        status: emailSubscription.status,
      })
      .from(emailSubscription)
      .where(eq(emailSubscription.channelToken, channelToken))
      .limit(1);
    return row ?? null;
  }

  async getForAccount(emailAccountId: string, resource = "mail") {
    const [row] = await db
      .select()
      .from(emailSubscription)
      .where(
        and(
          eq(emailSubscription.emailAccountId, emailAccountId),
          eq(emailSubscription.resource, resource),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  static async getSubscriptionsDueForRenewal() {
    // Build per-provider CASE expression so each subscription uses the right lead time
    const providerLeadCases = Object.entries(RENEWAL_LEAD_HOURS)
      .flatMap(([provider, resources]) =>
        Object.entries(resources).map(
          ([resource, hours]) =>
            `WHEN ea.provider = '${provider}' AND es.resource = '${resource}' THEN INTERVAL '${hours} hours'`,
        ),
      )
      .join(" ");
    const defaultLead = "INTERVAL '24 hours'";

    return db
      .select({
        emailSubscriptionId: emailSubscription.emailSubscriptionId,
        tenantId: emailSubscription.tenantId,
        emailAccountId: emailSubscription.emailAccountId,
        resource: emailSubscription.resource,
        providerSubscriptionId: emailSubscription.providerSubscriptionId,
        expiresAt: emailSubscription.expiresAt,
        provider: emailAccount.provider,
      })
      .from(emailSubscription)
      .innerJoin(emailAccount, eq(emailAccount.emailAccountId, emailSubscription.emailAccountId))
      .where(
        and(
          isNotNull(emailSubscription.expiresAt),
          or(
            // Already expired
            lt(emailSubscription.expiresAt, sql`now()`),
            // Within provider-specific lead window
            sql`${emailSubscription.expiresAt} < now() + CASE ${sql.raw(providerLeadCases)} ELSE ${sql.raw(defaultLead)} END`,
          ),
          sql`${emailSubscription.status} NOT IN ('failed', 'renewal_pending')`,
        ),
      );
  }

  static async getAccountsDueForBackstopSync(tierIntervals: Record<string, number>) {
    const VALID_TIERS = new Set(["hot", "warm", "cold", "dormant"]);
    // Allowlist keys and cast values to integers to prevent sql.raw injection
    const cases = Object.entries(tierIntervals)
      .filter(([tier]) => VALID_TIERS.has(tier))
      .map(
        ([tier, minutes]) =>
          `WHEN activity_tier = '${tier}' THEN INTERVAL '${Math.floor(Number(minutes))} minutes'`,
      )
      .join(" ");

    return db
      .select({
        emailAccountId: emailAccount.emailAccountId,
        tenantId: emailAccount.tenantId,
        activityTier: emailAccount.activityTier,
        syncPriority: emailAccount.syncPriority,
      })
      .from(emailAccount)
      .where(
        and(
          eq(emailAccount.archived, false),
          // hot accounts are excluded — they have live incremental syncs scheduled
          // but high-priority accounts still need backstop even when seemingly warm/cold
          or(
            sql`activity_tier IN ('warm', 'cold', 'dormant')`,
            sql`(activity_tier = 'hot' AND sync_priority = 'high')`,
          ),
          sql`(
            last_sync_at IS NULL OR
            last_sync_at < now() - CASE ${sql.raw(cases)} ELSE INTERVAL '1440 minutes' END
          )`,
        ),
      );
  }
}
