import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { resolveExecutionContext } from "#/lib/capability-auth";

// Server functions and API routes resolve the ExecutionContext through the
// same single entry point (lib/capability-auth.ts) — server functions are a
// transport adapter, never a second auth path.
export const capabilityContext = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const executionCtx = await resolveExecutionContext(getRequest());
  if (executionCtx instanceof Response) throw executionCtx;
  return next({ context: { executionCtx } });
});
