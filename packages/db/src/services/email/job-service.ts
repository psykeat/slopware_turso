import { and, asc, desc, eq, lt, lte, or, sql } from "drizzle-orm";

import { db } from "../../index";
import { emailJob } from "../../schema/app.schema";
import type { EmailJobType } from "./types";

export class EmailJobService {
  constructor(private tenantId: string) {}

  private readonly staleLockMs = 15 * 60 * 1000;

  private formatJob<
    T extends {
      attempts: number;
      maxAttempts: number;
      lockedAt: Date | null;
      lockedBy: string | null;
      status: string;
    },
  >(job: T | null) {
    if (!job) return null;
    return {
      ...job,
      attemptsRemaining: Math.max(job.maxAttempts - job.attempts, 0),
      isLocked: job.status === "running" && Boolean(job.lockedAt),
      retryable: job.status !== "done" && job.status !== "failed" && job.attempts < job.maxAttempts,
    };
  }

  async enqueue(input: {
    jobType: EmailJobType;
    emailAccountId?: string | null;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
    runAfter?: Date;
  }) {
    const [job] = await db
      .insert(emailJob)
      .values({
        tenantId: this.tenantId,
        emailAccountId: input.emailAccountId ?? null,
        jobType: input.jobType,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload ?? {},
        runAfter: input.runAfter ?? new Date(),
      })
      .onConflictDoUpdate({
        target: [emailJob.tenantId, emailJob.idempotencyKey],
        set: {
          status: "queued",
          runAfter: input.runAfter ?? new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return this.formatJob(job)!;
  }

  async list(
    options: {
      emailAccountId?: string | null;
      status?: string | null;
      jobType?: EmailJobType | null;
      limit?: number;
    } = {},
  ) {
    const conditions = [eq(emailJob.tenantId, this.tenantId)];
    if (options.emailAccountId)
      conditions.push(eq(emailJob.emailAccountId, options.emailAccountId));
    if (options.status) conditions.push(eq(emailJob.status, options.status));
    if (options.jobType) conditions.push(eq(emailJob.jobType, options.jobType));

    const rows = await db
      .select()
      .from(emailJob)
      .where(and(...conditions))
      .orderBy(desc(emailJob.createdAt))
      .limit(options.limit ?? 50);
    return rows.map((job) => this.formatJob(job));
  }

  async get(jobId: string) {
    const [job] = await db
      .select()
      .from(emailJob)
      .where(and(eq(emailJob.tenantId, this.tenantId), eq(emailJob.emailJobId, jobId)))
      .limit(1);
    return this.formatJob(job);
  }

  async claimNext(workerId: string) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - this.staleLockMs);

    return await db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(emailJob)
        .where(
          and(
            eq(emailJob.tenantId, this.tenantId),
            lt(emailJob.attempts, emailJob.maxAttempts),
            or(
              and(eq(emailJob.status, "queued"), lte(emailJob.runAfter, now)),
              and(eq(emailJob.status, "running"), lte(emailJob.lockedAt, staleBefore)),
            ),
          ),
        )
        .orderBy(asc(emailJob.runAfter), asc(emailJob.createdAt))
        .limit(1)
        .for("update");

      if (!candidate) return null;

      const [job] = await tx
        .update(emailJob)
        .set({
          status: "running",
          attempts: sql`${emailJob.attempts} + 1`,
          lockedAt: now,
          lockedBy: workerId,
          lastError: null,
          updatedAt: now,
        })
        .where(
          and(eq(emailJob.tenantId, this.tenantId), eq(emailJob.emailJobId, candidate.emailJobId)),
        )
        .returning();

      return this.formatJob(job);
    });
  }

  async claim(jobId: string, workerId: string) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - this.staleLockMs);

    return await db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(emailJob)
        .where(
          and(
            eq(emailJob.tenantId, this.tenantId),
            eq(emailJob.emailJobId, jobId),
            lt(emailJob.attempts, emailJob.maxAttempts),
            or(
              and(eq(emailJob.status, "queued"), lte(emailJob.runAfter, now)),
              and(eq(emailJob.status, "running"), lte(emailJob.lockedAt, staleBefore)),
            ),
          ),
        )
        .limit(1)
        .for("update");

      if (!candidate) return null;

      const [job] = await tx
        .update(emailJob)
        .set({
          status: "running",
          attempts: sql`${emailJob.attempts} + 1`,
          lockedAt: now,
          lockedBy: workerId,
          lastError: null,
          updatedAt: now,
        })
        .where(
          and(eq(emailJob.tenantId, this.tenantId), eq(emailJob.emailJobId, candidate.emailJobId)),
        )
        .returning();

      return this.formatJob(job);
    });
  }

  async complete(jobId: string, workerId?: string) {
    const [job] = await db
      .update(emailJob)
      .set({
        status: "done",
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailJob.tenantId, this.tenantId),
          eq(emailJob.emailJobId, jobId),
          workerId ? eq(emailJob.lockedBy, workerId) : sql`true`,
        ),
      )
      .returning();
    return this.formatJob(job ?? null);
  }

  async fail(jobId: string, error: unknown, retryAfter?: Date, workerId?: string) {
    const message = error instanceof Error ? error.message : String(error);
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(emailJob)
        .where(
          and(
            eq(emailJob.tenantId, this.tenantId),
            eq(emailJob.emailJobId, jobId),
            workerId ? eq(emailJob.lockedBy, workerId) : sql`true`,
          ),
        )
        .limit(1)
        .for("update");

      if (!current) return null;

      const shouldRetry = Boolean(retryAfter && current.attempts < current.maxAttempts);
      const [job] = await tx
        .update(emailJob)
        .set({
          status: shouldRetry ? "queued" : "failed",
          runAfter: shouldRetry ? retryAfter : new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: message,
          updatedAt: new Date(),
        })
        .where(and(eq(emailJob.tenantId, this.tenantId), eq(emailJob.emailJobId, jobId)))
        .returning();
      return this.formatJob(job ?? null);
    });
  }
}
