import assert from "node:assert/strict";
import test from "node:test";

import { EmailJobService, emailRunStore } from "./job-service";

test("Email background job is correctly enqueued and executed via workflow-core", async () => {
  const service = new EmailJobService("test-tenant");

  const job = await service.enqueue({
    jobType: "incremental_sync",
    emailAccountId: "test-account",
    idempotencyKey: "test-key",
  });

  assert.equal(job.status, "queued");

  // Wait a short tick for the async workflow execution to register
  await new Promise((resolve) => setTimeout(resolve, 50));

  const runState = await emailRunStore.getRunState(job.emailJobId);
  assert.ok(runState, "Expected run state to exist in workflow-core run store");

  const input = runState.input as any;
  assert.equal(input.jobType, "incremental_sync");
  assert.equal(input.emailAccountId, "test-account");
  assert.equal(input.tenantId, "test-tenant");

  // Since test-account doesn't exist, the job should fail gracefully
  // Testing that the workflow handles execution as expected
  assert.equal(runState.status, "errored");
  assert.ok(runState.error, "Expected workflow to finish with error for missing account");
});
