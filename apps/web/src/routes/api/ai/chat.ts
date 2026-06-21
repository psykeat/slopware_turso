import {
  buildOverlayTools,
  chatParamsFromRequest,
  createConfiguredProvider,
  maxIterations,
  mergeAgentTools,
  toServerSentEventsResponse,
} from "@repo/agent";
import { resolveLlmRuntimeConfig } from "@repo/db/services/ai-orchestrator";
import { createFileRoute } from "@tanstack/react-router";

import { resolveExecutionContext } from "#/lib/capability-auth";

// Interactive AI overlay endpoint. Unlike the headless /api/ai/execute (which
// excludes confirm capabilities because it has no human-in-the-loop), this route
// runs the agent loop with the approval handshake so confirm-gated writes pause
// for the user via the @tanstack/ai-client ChatClient.
//
// Stateless by design: the client owns the transcript (UIMessage[]) and replays
// it each turn, including resumes. No ai_thread table in v1 — the audit trail
// lives in capability_execution_log and replay is safe (idempotency tests).
//
// Tool selection follows "reads global, writes scoped": every read capability is
// available as an exploration backbone, writes are curated to the focused group
// seeded from the overlay's Invocation Context (forwardedProps.group). The model
// never sees raw services and never receives a tenantId.

const SYSTEM_PROMPT = `You are the in-app assistant for an ERP system, operating over a capability toolset.

Working rules:
- Explore first. Read the user's context and any referenced records, combine multiple sources, and resolve references (customers, articles, documents) with the lookup/read tools before proposing an action. Confirm-gates are an execution boundary, not a thinking boundary — keep reasoning and reading freely.
- Evaluate the available material fully before concluding you are too uncertain. Only when genuine ambiguity remains after that, call assistant_requestDecision with the ranked candidates to ask the user to choose — it is the last resort, not a first gate.
- Chain atomic verbs to accomplish a goal; scenarios are not pre-wired. Every data-changing capability requires explicit user approval at its own write-boundary — request it, do not assume it.
- Never invent ids. Use the values returned by the tools. If a required capability does not exist, say so plainly instead of improvising.`;

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await resolveExecutionContext(request);
        if (ctx instanceof Response) return ctx;

        // Parses + validates the AG-UI RunAgentInput. Throws a 400 Response on a
        // malformed body, which TanStack Start returns to the client.
        const params = await chatParamsFromRequest(request);

        const focusGroup =
          typeof params.forwardedProps.group === "string" ? params.forwardedProps.group : undefined;

        const serverTools = buildOverlayTools(
          { ...ctx, actorMode: "assistant" },
          { focusGroups: focusGroup ? [focusGroup] : undefined, confirmMode: "approval" },
        );
        // Merge client-declared tools (e.g. assistant.requestDecision): the model
        // can call them, the loop pauses (tool-input-available), and the client
        // executes them and posts the result back to resume.
        const tools = mergeAgentTools(serverTools, params.tools);

        const llm = await resolveLlmRuntimeConfig(ctx.tenantId, ctx.userId ?? undefined);
        const provider = createConfiguredProvider({
          provider: llm.providerName,
          model: llm.modelName,
          apiKey: llm.apiKey || undefined,
          endpointUrl: llm.gatewayUrl || undefined,
          vertexCredentials: llm.vertexCredentials || undefined,
          vertexProject: llm.vertexProject || undefined,
          vertexLocation: llm.vertexLocation || undefined,
        });

        const stream = provider.stream({
          messages: params.messages,
          tools,
          systemPrompts: [SYSTEM_PROMPT],
          agentLoopStrategy: maxIterations(16),
        });

        return toServerSentEventsResponse(stream);
      },
    },
  },
});
