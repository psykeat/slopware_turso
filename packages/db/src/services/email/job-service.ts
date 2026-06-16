import { and, eq, lt, sql } from "drizzle-orm";

import { db } from "../../index";
import { emailJob } from "../../schema/app.schema";
import type { EmailJobType } from "./types";

const TIER_PRIORITY: Record<string, number> = { hot: 1, warm: 2, cold: 3, dormant: 3 };

export function activityTierPriority(tier: string): number {
  return TIER_PRIORITY[tier] ?? 2;
}

export type EmailJobExecutor = (input: {
  jobType: string;
  emailAccountId: string;
  payload: Record<string, unknown>;
}) => Promise<unknown>;

async function runJobInBackground(
  jobId: string,
  jobType: string,
  emailAccountId: string | null | undefined,
  payload: Record<string, unknown>,
  executor: EmailJobExecutor,
) {
  const now = new Date();

  // Atomically claim: only proceed if we win the status='queued' race
  const [claimed] = await db
    .update(emailJob)
    .set({ status: "processing", lockedAt: now, lockedBy: "inline-worker", updatedAt: now })
    .where(and(eq(emailJob.emailJobId, jobId), eq(emailJob.status, "queued")))
    .returning({ emailJobId: emailJob.emailJobId });

  if (!claimed) return; // another worker already claimed it

  try {
    await executor({ jobType, emailAccountId: emailAccountId ?? "", payload });

    // Guard by lockedBy so a reclaimed job isn't stomped if we ran long
    await db
      .update(emailJob)
      .set({ status: "done", lockedAt: null, lockedBy: null, updatedAt: new Date() })
      .where(
        and(eq(emailJob.emailJobId, jobId), eq(emailJob.lockedBy, "inline-worker")),
      );
  } catch (err) {
    console.error("[EmailJobService] background job failed", err);
    const errorMessage = err instanceof Error ? err.message : String(err);

    const [current] = await db
      .select({ attempts: emailJob.attempts, maxAttempts: emailJob.maxAttempts })
      .from(emailJob)
      .where(
        and(eq(emailJob.emailJobId, jobId), eq(emailJob.lockedBy, "inline-worker")),
      )
      .limit(1);

    if (current) {
      const attempts = current.attempts + 1;
      const exhausted = attempts >= current.maxAttempts;
      const backoffMinutes = Math.pow(2, attempts);
      const runAfter = new Date(Date.now() + backoffMinutes * 60 * 1000);
      await db
        .update(emailJob)
        .set({
          status: exhausted ? "failed" : "queued",
          attempts,
          runAfter: exhausted ? new Date() : runAfter,
          lockedAt: null,
          lockedBy: null,
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(
          and(eq(emailJob.emailJobId, jobId), eq(emailJob.lockedBy, "inline-worker")),
        );
    }
  }
}

export class EmailJobService {
  constructor(
    private tenantId: string,
    private options: { executor?: EmailJobExecutor } = {},
  ) {}

  async enqueue(input: {
    jobType: EmailJobType;
    emailAccountId?: string | null;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
    runAfter?: Date;
    priority?: number;
  }) {
    const runAfter = input.runAfter ?? new Date();
    const [row] = await db
      .insert(emailJob)
      .values({
        tenantId: this.tenantId,
        emailAccountId: input.emailAccountId ?? null,
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload ?? {},
        status: "queued",
        priority: input.priority ?? 2,
        attempts: 0,
        maxAttempts: 5,
        runAfter,
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    if (!row) {
      const [existing] = await db
        .select()
        .from(emailJob)
        .where(
          and(
            eq(emailJob.tenantId, this.tenantId),
            eq(emailJob.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      return existing ?? null;
    }

    // For immediate jobs, fire off background execution so they run without waiting for a worker poll
    if (runAfter <= new Date() && this.options.executor) {
      void runJobInBackground(
        row.emailJobId,
        input.jobType,
        input.emailAccountId,
        input.payload ?? {},
        this.options.executor,
      );
    }

    return row;
  }

  async list() {
    return db
      .select()
      .from(emailJob)
      .where(eq(emailJob.tenantId, this.tenantId))
      .orderBy(emailJob.createdAt)
      .limit(100);
  }

  async get(jobId: string) {
    const [row] = await db
      .select()
      .from(emailJob)
      .where(and(eq(emailJob.tenantId, this.tenantId), eq(emailJob.emailJobId, jobId)))
      .limit(1);
    return row ?? null;
  }

  async claimNext(workerId: string) {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000);

    // Canonical Postgres queue pattern: UPDATE WHERE pk = (subquery FOR UPDATE SKIP LOCKED)
    // No redundant outer conditions — the subquery handles all filtering atomically
    const [claimed] = await db
      .update(emailJob)
      .set({ status: "processing", lockedAt: now, lockedBy: workerId, updatedAt: now })
      .where(
        sql`email_job_id = (
          SELECT email_job_id FROM email_job
          WHERE tenant_id = ${this.tenantId}
            AND (status = 'queued' OR (status = 'processing' AND locked_at < ${staleThreshold.toISOString()}))
            AND run_after <= ${now.toISOString()}
          ORDER BY priority ASC, run_after ASC, created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )`,
      )
      .returning();
    return claimed ?? null;
  }

  static async reaperRun(staleMinutes = 10): Promise<number> {
    const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000);
    const errorMsg = `reaped after ${staleMinutes}min lock timeout`;
    // No attempts < maxAttempts guard: exhausted stuck jobs must also be resolved (to 'failed')
    const rows = await db
      .update(emailJob)
      .set({
        status: sql`CASE WHEN ${emailJob.attempts} + 1 >= ${emailJob.maxAttempts} THEN 'failed' ELSE 'queued' END`,
        lockedAt: null,
        lockedBy: null,
        attempts: sql`${emailJob.attempts} + 1`,
        lastError: errorMsg,
        runAfter: sql`CASE WHEN ${emailJob.attempts} + 1 >= ${emailJob.maxAttempts} THEN ${emailJob.runAfter} ELSE now() + INTERVAL '1 minute' END`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailJob.status, "processing"),
          lt(emailJob.lockedAt, staleThreshold),
        ),
      )
      .returning({ emailJobId: emailJob.emailJobId });
    return rows.length;
  }

  async complete(jobId: string, workerId?: string) {
    const now = new Date();
    const conditions = [eq(emailJob.emailJobId, jobId)];
    if (workerId) conditions.push(eq(emailJob.lockedBy, workerId));

    const [row] = await db
      .update(emailJob)
      .set({ status: "done", lockedAt: null, lockedBy: null, updatedAt: now })
      .where(and(...conditions))
      .returning();
    return row ?? null;
  }

  async fail(jobId: string, error: unknown, _workerId?: string) {
    const now = new Date();
    const errorMessage = error instanceof Error ? error.message : String(error);

    const [current] = await db
      .select({ attempts: emailJob.attempts, maxAttempts: emailJob.maxAttempts })
      .from(emailJob)
      .where(eq(emailJob.emailJobId, jobId))
      .limit(1);

    if (!current) return null;

    const attempts = current.attempts + 1;
    const exhausted = attempts >= current.maxAttempts;
    const backoffMinutes = Math.pow(2, attempts);
    const runAfter = new Date(now.getTime() + backoffMinutes * 60 * 1000);

    const [row] = await db
      .update(emailJob)
      .set({
        status: exhausted ? "failed" : "queued",
        attempts,
        runAfter: exhausted ? now : runAfter,
        lockedAt: null,
        lockedBy: null,
        lastError: errorMessage,
        updatedAt: now,
      })
      .where(eq(emailJob.emailJobId, jobId))
      .returning();
    return row ?? null;
  }
}
