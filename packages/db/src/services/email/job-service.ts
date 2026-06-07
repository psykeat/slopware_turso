import { randomUUID } from "node:crypto";

import { inMemoryRunStore, createWorkflow, runWorkflow } from "@tanstack/workflow-core";

import { EmailSyncService } from "./sync-service";
import type { EmailJobType } from "./types";

export const emailRunStore = inMemoryRunStore();

export const emailWorkflow = createWorkflow({
  id: "emailWorkflow",
}).handler(async (ctx) => {
  console.log("[Workflow Debug] Starting emailWorkflow", ctx.input);
  try {
    const { tenantId, userId, jobType, emailAccountId, payload } = ctx.input as any;
    const syncService = new EmailSyncService(tenantId, userId);
    await syncService.executeJob(jobType, emailAccountId, payload);
    console.log("[Workflow Debug] Finished emailWorkflow successfully");
    return { status: "done" };
  } catch (error) {
    console.error("[Workflow Debug] emailWorkflow failed", error);
    throw error;
  }
});

export class EmailJobService {
  constructor(private tenantId: string) {}

  async enqueue(input: {
    jobType: EmailJobType;
    emailAccountId?: string | null;
    idempotencyKey: string;
    payload?: Record<string, unknown>;
    runAfter?: Date;
  }) {
    const runId = randomUUID();

    // Background execution
    (async () => {
      try {
        for await (const _event of runWorkflow({
          workflow: emailWorkflow,
          runStore: emailRunStore,
          runId,
          input: {
            tenantId: this.tenantId,
            userId: "system",
            jobType: input.jobType,
            emailAccountId: input.emailAccountId,
            payload: input.payload,
          },
        })) {
          // ignore
        }
      } catch (err) {
        console.error("Workflow failed", err);
      }
    })();

    return {
      emailJobId: runId,
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      lockedAt: null,
      lockedBy: null,
      retryable: true,
      attemptsRemaining: 3,
      isLocked: false,
    };
  }

  async list() {
    return [];
  }

  async get(jobId: string) {
    const state = await emailRunStore.getRunState(jobId);
    if (!state) return null;
    return {
      emailJobId: state.runId,
      jobType: (state.input as any).jobType,
      status: state.status === "finished" ? "done" : state.status,
      attempts: 1,
      maxAttempts: 3,
      lockedAt: null,
      lockedBy: null,
      retryable: false,
      attemptsRemaining: 0,
      isLocked: false,
      lastError: state.error ? state.error.message : null,
    };
  }

  async claimNext(_workerId: string) {
    return null;
  }

  async claim(_jobId: string, _workerId: string) {
    return null;
  }

  async complete(jobId: string, _workerId?: string) {
    return { emailJobId: jobId, status: "done" };
  }

  async fail(jobId: string, _error: unknown, _retryAfter?: Date, _workerId?: string) {
    return { emailJobId: jobId, status: "failed" };
  }
}
