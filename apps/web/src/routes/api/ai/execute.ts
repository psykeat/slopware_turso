import { buildCapabilityTools, createConfiguredProvider, maxIterations } from "@repo/agent";
import type { ConfirmMode } from "@repo/agent";
import { resolveLlmRuntimeConfig } from "@repo/db/services/ai-orchestrator";
import { createFileRoute } from "@tanstack/react-router";

import { resolveExecutionContext } from "#/lib/capability-auth";

// The single AI execute entry point. The model talks to the capability runtime
// through `buildCapabilityTools` only — it never sees raw services and never
// receives a tenantId. Tool selection (group / keys), confirmation policy and
// the tenant/actor context are all resolved server-side here.
//
// Confirm-gated capabilities (post / storno / delete / send) are EXCLUDED by
// default because this REST endpoint has no interactive approval channel; a
// caller that owns the human-in-the-loop can opt in with confirmMode.

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type ExecuteBody = {
  prompt?: string;
  messages?: ChatMessage[];
  system?: string;
  group?: string;
  keys?: string[];
  confirmMode?: ConfirmMode;
  maxIterations?: number;
  stream?: boolean;
};

type ToolCall = { name: string; input: unknown; output?: unknown };

function buildMessages(body: ExecuteBody): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (body.system?.trim()) messages.push({ role: "system", content: body.system });
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    messages.push(...body.messages);
  } else if (body.prompt?.trim()) {
    messages.push({ role: "user", content: body.prompt });
  }
  return messages;
}

export const Route = createFileRoute("/api/ai/execute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await resolveExecutionContext(request);
        if (ctx instanceof Response) return ctx;

        const body = (await request.json().catch(() => null)) as ExecuteBody | null;
        const messages = body ? buildMessages(body) : [];
        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: "prompt or messages is required" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const tools = buildCapabilityTools(
          { ...ctx, actorMode: "assistant" },
          {
            group: body?.group,
            keys: body?.keys,
            // Curated set unless a specific group/keys scope is requested.
            activeByDefaultOnly: !body?.group && !body?.keys,
            confirmMode: body?.confirmMode ?? "exclude",
          },
        );

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

        const iterations = Math.min(Math.max(body?.maxIterations ?? 12, 1), 25);

        const runStream = () =>
          provider.stream({
            messages: messages as any,
            tools,
            agentLoopStrategy: maxIterations(iterations),
          });

        // Streaming variant: forward each chunk as an SSE event, mirroring the
        // existing /api/ai SSE routes.
        if (body?.stream) {
          const encoder = new TextEncoder();
          const sse = new ReadableStream({
            async start(controller) {
              const send = (event: string, data: unknown) => {
                try {
                  controller.enqueue(
                    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
                  );
                } catch {
                  // client disconnected
                }
              };
              try {
                for await (const chunk of runStream()) {
                  send("chunk", chunk);
                }
                send("done", { ok: true });
              } catch (error) {
                send("error", {
                  message: error instanceof Error ? error.message : "AI execution failed",
                });
              } finally {
                controller.close();
              }
            },
          });
          return new Response(sse, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        }

        // Non-streaming: accumulate the final assistant text and the tool calls
        // that ran, then return a single JSON envelope.
        const textBuffers = new Map<string, string>();
        const textParts: string[] = [];
        const toolCalls: ToolCall[] = [];
        const toolCallIndex = new Map<string, number>();

        try {
          for await (const rawChunk of runStream()) {
            const chunk = rawChunk as Record<string, unknown>;
            const type = typeof chunk.type === "string" ? chunk.type : "";
            const id = typeof chunk.id === "string" ? chunk.id : "assistant";

            if (type === "TEXT_MESSAGE_START") {
              textBuffers.set(id, "");
            } else if (type === "TEXT_MESSAGE_CONTENT") {
              const delta = typeof chunk.delta === "string" ? chunk.delta : "";
              textBuffers.set(id, (textBuffers.get(id) ?? "") + delta);
            } else if (type === "TEXT_MESSAGE_END") {
              const message =
                typeof chunk.content === "string" ? chunk.content : (textBuffers.get(id) ?? "");
              if (message) textParts.push(message);
              textBuffers.delete(id);
            } else if (type === "TOOL_CALL_START") {
              const callId =
                typeof chunk.toolCallId === "string"
                  ? chunk.toolCallId
                  : typeof chunk.id === "string"
                    ? chunk.id
                    : String(toolCalls.length);
              const name = typeof chunk.toolName === "string" ? chunk.toolName : "unknown_tool";
              toolCallIndex.set(callId, toolCalls.length);
              toolCalls.push({ name, input: chunk.args ?? chunk.input ?? null });
            } else if (type === "TOOL_CALL_END") {
              const callId = typeof chunk.toolCallId === "string" ? chunk.toolCallId : "";
              const index = toolCallIndex.get(callId);
              if (index !== undefined) {
                toolCalls[index].output = chunk.result ?? chunk.output ?? chunk.content ?? null;
              }
            }
          }
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "AI execution failed",
            }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            text: textParts.join(""),
            toolCalls,
            toolCount: tools.length,
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
