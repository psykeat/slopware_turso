import { auth } from "@repo/auth/auth";
import { db } from "@repo/db";
import { emailThread, emailMessage } from "@repo/db/schema";
import { AIDiscoveryService } from "@repo/db/services/ai-discovery";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { resolveTenantContext } from "#/lib/resolve-tenant";

export const Route = createFileRoute("/api/ai/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });
        const tenantId = context.tenantId;

        const url = new URL(request.url);
        const path = url.pathname;

        try {
          // 1. GET /api/ai/catalog/entities
          if (path === "/api/ai/catalog/entities") {
            const scopeParam = url.searchParams.get("scope") || "all";
            const taskScope = scopeParam.split(",");
            const catalog = await AIDiscoveryService.getSemanticEntityCatalog(tenantId, taskScope);
            return new Response(JSON.stringify({ entities: catalog }), {
              headers: { "content-type": "application/json" },
            });
          }

          // 2. GET /api/ai/catalog/entities/:entityName
          if (path.startsWith("/api/ai/catalog/entities/")) {
            const entityName = path.split("/").pop() || "";
            const fields = await AIDiscoveryService.getSemanticFieldCatalog(entityName, tenantId);
            return new Response(JSON.stringify({ entityName, fields }), {
              headers: { "content-type": "application/json" },
            });
          }

          // 3. GET /api/ai/catalog/commands
          if (path === "/api/ai/catalog/commands") {
            const scopeParam = url.searchParams.get("scope") || "all";
            const taskScope = scopeParam.split(",");
            const commands = await AIDiscoveryService.getSemanticCommandCatalog(
              tenantId,
              taskScope,
            );
            return new Response(JSON.stringify({ commands }), {
              headers: { "content-type": "application/json" },
            });
          }

          // GET /api/ai/context/mail-thread/:threadId
          if (path.startsWith("/api/ai/context/mail-thread/")) {
            const threadId = path.split("/").pop() || "";
            const thread = await db
              .select()
              .from(emailThread)
              .where(
                and(eq(emailThread.emailThreadId, threadId), eq(emailThread.tenantId, tenantId)),
              )
              .limit(1);

            if (thread.length === 0) {
              return new Response("Thread not found", { status: 404 });
            }

            const messages = await db
              .select()
              .from(emailMessage)
              .where(
                and(eq(emailMessage.emailThreadId, threadId), eq(emailMessage.tenantId, tenantId)),
              );

            return new Response(
              JSON.stringify({
                threadId: thread[0].emailThreadId,
                subject: thread[0].subject,
                relatedDocumentId: thread[0].relatedDocumentId,
                relatedAddressId: thread[0].relatedAddressId,
                messages: messages.map((m) => ({
                  messageId: m.emailMessageId,
                  direction: m.direction,
                  fromJson: m.fromJson,
                  toJson: m.toJson,
                  subject: m.subject,
                  bodyText: m.bodyText,
                  bodyHtml: m.bodyHtml,
                })),
              }),
              {
                headers: { "content-type": "application/json" },
              },
            );
          }

          return new Response("Not Found", { status: 404 });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message, errorClass: "AI_UNAVAILABLE" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },

      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) return new Response("Unauthorized", { status: 401 });

        const isSystemAdmin = (session.user as any).isSystemAdmin;
        const context = await resolveTenantContext(request, session.user.id, isSystemAdmin);
        if (!context) return new Response("Forbidden", { status: 403 });
        const tenantId = context.tenantId;
        const userId = session.user.id;

        const url = new URL(request.url);
        const path = url.pathname;

        try {
          // 0. POST /api/ai/context/resolve
          if (path === "/api/ai/context/resolve") {
            const body = (await request.json()) as {
              workspace?: string | null;
              panel?: string | null;
              focusArea?: string | null;
              entityName?: string | null;
              recordId?: string | null;
              mode?: string | null;
              invocationSource?: string | null;
            };

            const supportedTasks: Array<{ taskScope: string; label: string; icon: string }> = [];
            let defaultTaskScope: string | null = null;
            let sourceEntity: string | null = null;
            let sourceId: string | null = null;
            let allowedCommands: string[] = [];

            if (
              (body.workspace === "email" || body.entityName === "emailThread") &&
              body.recordId
            ) {
              const threadId = body.recordId;
              const threadExists = await db
                .select()
                .from(emailThread)
                .where(
                  and(eq(emailThread.emailThreadId, threadId), eq(emailThread.tenantId, tenantId)),
                )
                .limit(1);

              if (threadExists.length === 0) {
                return new Response(
                  JSON.stringify({
                    error: "E-Mail-Thread nicht gefunden oder gehört anderem Mandanten",
                    errorClass: "CONTEXT_NOT_RESOLVABLE",
                  }),
                  {
                    status: 404,
                    headers: { "content-type": "application/json" },
                  },
                );
              }

              supportedTasks.push({
                taskScope: "mail-order-review",
                label: "E-Mail prüfen & Auftrag auflösen",
                icon: "Sparkles",
              });
              defaultTaskScope = "mail-order-review";
              sourceEntity = "emailThread";
              sourceId = threadId;
              allowedCommands = [
                "apply-ai-mail-classification",
                "convert-document-from-ai-review",
                "prepare-document-email",
              ];
            }

            return new Response(
              JSON.stringify({
                supportedTasks,
                defaultTaskScope,
                sourceEntity,
                sourceId,
                allowedCommands,
              }),
              {
                headers: { "content-type": "application/json" },
              },
            );
          }

          // 1. POST /api/ai/catalog/context
          if (path === "/api/ai/catalog/context") {
            const catalogContext = await AIDiscoveryService.getSemanticContext(tenantId);
            return new Response(JSON.stringify({ context: catalogContext }), {
              headers: { "content-type": "application/json" },
            });
          }

          // 2. POST /api/ai/plan
          if (path === "/api/ai/plan") {
            const body = (await request.json()) as {
              taskScope?: string[];
              rawInput: string;
            };
            if (!body.rawInput) {
              return new Response(JSON.stringify({ error: "Missing rawInput parameter" }), {
                status: 400,
                headers: { "content-type": "application/json" },
              });
            }

            // Extract emailThreadId from rawInput context if present
            let emailThreadId = "";
            try {
              const parsed = JSON.parse(body.rawInput);
              emailThreadId = parsed.emailThreadId || "";
            } catch {
              // Ignore
            }

            // V2 Hybrid Orchestrated Compatibility Wrapper
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const interpretRes = await AIOrchestratorService.interpretMailThread({
              threadId: emailThreadId || crypto.randomUUID(),
              rawInput: body.rawInput,
              tenantId,
              userId,
            });

            const resolveRes = await AIOrchestratorService.resolveMailThread({
              interpretationId: interpretRes.interpretationId,
              tenantId,
            });

            const reviewRes = await AIOrchestratorService.buildMailReview({
              interpretationId: interpretRes.interpretationId,
              resolution: resolveRes.resolution,
              tenantId,
            });

            const _validation = await AIOrchestratorService.validateMailReview({
              reviewId: reviewRes.reviewId,
              tenantId,
            });

            // Convert the bundle review back to legacy step format for compatibility.
            const steps: any[] = [];
            const selectedBundle =
              reviewRes.review.bundles?.find(
                (bundle: any) => bundle.bundleId === reviewRes.review.selectedBundleId,
              ) ??
              reviewRes.review.bundles?.[0] ??
              null;
            const customerSlot = selectedBundle?.resolverSlots?.find(
              (slot: any) => slot.slotKey === "customer",
            );
            const documentSlot = selectedBundle?.resolverSlots?.find(
              (slot: any) => slot.slotKey === "referenceDocument",
            );

            if (customerSlot || documentSlot) {
              steps.push({
                stepIndex: 1,
                actionType: "LOOKUP",
                entityName: "address",
                lookupCriteria: customerSlot?.candidates?.[0] ? { name: "search" } : {},
                candidateMatches: (customerSlot?.candidates || []).map((c: any) => ({
                  id: c.id,
                  displayValue: c.label,
                  matchScore: c.score ?? (c.recommended ? 1.0 : 0.8),
                })),
                selectedMatchId: customerSlot?.resolvedId || undefined,
              });
            }

            if (documentSlot) {
              steps.push({
                stepIndex: steps.length + 1,
                actionType: "LOOKUP",
                entityName: "document",
                lookupCriteria: documentSlot.candidates?.[0] ? { code: "search" } : {},
                candidateMatches: documentSlot.candidates.map((c: any) => ({
                  id: c.id,
                  displayValue: c.label,
                  matchScore: c.score ?? (c.recommended ? 1.0 : 0.8),
                })),
                selectedMatchId: documentSlot.resolvedId || undefined,
              });
            }

            if (
              selectedBundle?.commandPreview?.some(
                (step: any) => step.commandKey === "convert-document-from-ai-review",
              )
            ) {
              steps.push({
                stepIndex: steps.length + 1,
                actionType: "EXECUTE_COMMAND",
                commandKey: "convert-document-from-ai-review",
                commandPayload: {
                  sourceDocumentId: documentSlot?.resolvedId ? `dependency:2` : undefined,
                  targetDocType: "Order",
                },
              });
            }

            steps.push({
              stepIndex: steps.length + 1,
              actionType: "EXECUTE_COMMAND",
              commandKey: "apply-ai-mail-classification",
              commandPayload: {
                relatedAddressId: customerSlot ? `dependency:1` : undefined,
                relatedDocumentId: documentSlot ? `dependency:${customerSlot ? 2 : 1}` : undefined,
              },
            });

            if (
              selectedBundle?.commandPreview?.some(
                (step: any) => step.commandKey === "prepare-document-email",
              )
            ) {
              steps.push({
                stepIndex: steps.length + 1,
                actionType: "EXECUTE_COMMAND",
                commandKey: "prepare-document-email",
                commandPayload: {
                  documentId: documentSlot?.resolvedId ? `dependency:2` : undefined,
                  emailIdentityId: undefined,
                },
              });
            }

            return new Response(
              JSON.stringify({
                planId: reviewRes.reviewId, // Map reviewId as planId
                planJson: {
                  steps,
                  bundles: reviewRes.review.bundles,
                  selectedBundleId: reviewRes.review.selectedBundleId,
                  businessIntention: reviewRes.review.intentBadge.label,
                  confidenceScore: reviewRes.review.intentBadge.confidenceScore,
                  applyReadiness:
                    reviewRes.review.reviewStatus === "ready_for_review"
                      ? "ready_for_review"
                      : "needs_user_input",
                  blockedReasons: reviewRes.review.blockingIssues.map((i: any) => i.message),
                  _llmTrace: reviewRes.review._llmTrace,
                },
                validation: {
                  warnings: reviewRes.review.warnings,
                  blockedReasons: reviewRes.review.blockingIssues.map((i: any) => i.message),
                },
              }),
              {
                headers: { "content-type": "application/json" },
              },
            );
          }

          // 3. POST /api/ai/tasks/mail/interpret-thread
          if (path === "/api/ai/tasks/mail/interpret-thread") {
            const body = (await request.json()) as {
              threadId: string;
              rawInput?: string;
              customInstructions?: string;
            };
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.interpretMailThread({
              threadId: body.threadId,
              rawInput: body.rawInput,
              customInstructions: body.customInstructions,
              tenantId,
              userId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // 4. POST /api/ai/tasks/mail/resolve-thread
          if (path === "/api/ai/tasks/mail/resolve-thread") {
            const body = (await request.json()) as { interpretationId: string };
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.resolveMailThread({
              interpretationId: body.interpretationId,
              tenantId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // 5. POST /api/ai/tasks/mail/build-review
          if (path === "/api/ai/tasks/mail/build-review") {
            const body = (await request.json()) as { interpretationId: string; resolution: any };
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.buildMailReview({
              interpretationId: body.interpretationId,
              resolution: body.resolution,
              tenantId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // 6. POST /api/ai/reviews/:reviewId/validate
          if (path.startsWith("/api/ai/reviews/") && path.endsWith("/validate")) {
            const parts = path.split("/");
            const reviewId = parts[parts.length - 2];
            const body = ((await request.json()) as { overrides?: any }) || {};
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.validateMailReview({
              reviewId,
              overrides: body.overrides,
              tenantId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // 7. POST /api/ai/reviews/:reviewId/apply
          if (path.startsWith("/api/ai/reviews/") && path.endsWith("/apply")) {
            const parts = path.split("/");
            const reviewId = parts[parts.length - 2];
            const body = ((await request.json()) as { overrides?: any }) || {};
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.applyMailReview({
              reviewId,
              overrides: body.overrides,
              tenantId,
              userId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          // Fallback legacy endpoints
          if (path.startsWith("/api/ai/plans/") && path.endsWith("/validate")) {
            const parts = path.split("/");
            const planId = parts[parts.length - 2];
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.validateMailReview({
              reviewId: planId,
              tenantId,
            });
            return new Response(JSON.stringify(result), {
              headers: { "content-type": "application/json" },
            });
          }

          if (path.startsWith("/api/ai/plans/") && path.endsWith("/apply")) {
            const parts = path.split("/");
            const planId = parts[parts.length - 2];
            const body = (await request.json()) as { userOverrides?: any };
            const { AIOrchestratorService } = await import("@repo/db/services/ai-orchestrator");
            const result = await AIOrchestratorService.applyMailReview({
              reviewId: planId,
              overrides: body.userOverrides,
              tenantId,
              userId,
            });
            const status = result.success ? 200 : 400;
            return new Response(JSON.stringify({ status: result.success ? "success" : "failed" }), {
              status,
              headers: { "content-type": "application/json" },
            });
          }

          return new Response("Not Found", { status: 404 });
        } catch (e: any) {
          let errorClass = "AI_UNAVAILABLE";
          const msg = e.message || "";
          if (msg.includes("Unauthorized") || msg.includes("Forbidden")) {
            errorClass = "UNAUTHORIZED";
          } else if (msg.includes("not found") || msg.includes("exist")) {
            errorClass = "CONTEXT_NOT_RESOLVABLE";
          } else if (msg.includes("Timeout") || msg.includes("timeout")) {
            errorClass = "MODEL_TIMEOUT";
          } else if (msg.includes("validation") || msg.includes("Zod")) {
            errorClass = "SCHEMA_VALIDATION_FAILED";
          } else if (msg.includes("stale") || msg.includes("lock") || msg.includes("version")) {
            errorClass = "STALE_CONTEXT";
          } else if (msg.includes("apply") || msg.includes("Apply") || msg.includes("Command")) {
            errorClass = "APPLY_VALIDATION_FAILED";
          }

          return new Response(JSON.stringify({ error: msg, errorClass }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
