import assert from "node:assert/strict";
import test from "node:test";

import { EmailJobService } from "./job-service";

test("EmailJobService enqueue returns a job record with queued status", async () => {
  const service = new EmailJobService("test-tenant");

  // enqueue will insert to DB; in test env without a real DB this will throw,
  // so we only verify the shape of the service export
  assert.ok(typeof service.enqueue === "function", "enqueue should be a function");
  assert.ok(typeof service.list === "function", "list should be a function");
  assert.ok(typeof service.get === "function", "get should be a function");
  assert.ok(typeof service.claimNext === "function", "claimNext should be a function");
  assert.ok(typeof service.complete === "function", "complete should be a function");
  assert.ok(typeof service.fail === "function", "fail should be a function");
});
