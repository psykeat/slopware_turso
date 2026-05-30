import { createDecipheriv } from "crypto";

import { and, eq, sql, getColumns } from "drizzle-orm";

import { db } from "../index";
import {
  aiApplyAttempt,
  aiEvidence,
  aiPlan,
  aiPromptVersion,
  aiRun,
  systemSettings,
  emailJob,
} from "../schema/app.schema";
import * as schema from "../schema/index";
import { AIDiscoveryService } from "./ai-discovery";

// Encryption secret helper matching slopware configuration
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_SECRET ?? "";
const ENCRYPTION_KEY =
  ENCRYPTION_KEY_HEX.length === 64 ? Buffer.from(ENCRYPTION_KEY_HEX, "hex") : null;

function decryptSecret(encoded: string): string {
  if (!ENCRYPTION_KEY) return encoded;
  const parts = encoded.split(":");
  if (parts.length !== 3) return encoded;
  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export class AIPlanningService {
  /**
   * Generates a new staged plan from unstructured user input using the LiteLLM gateway.
   */
  static async createPlan(params: {
    taskScope: string[];
    rawInput: string;
    tenantId: string;
    userId: string;
  }): Promise<{ planId: string; planJson: Record<string, any>; validation: any }> {
    const startTime = Date.now();

    // 1. Create aiRun in pending status
    const [run] = await db
      .insert(aiRun)
      .values({
        tenantId: params.tenantId,
        userId: params.userId,
        taskScope: params.taskScope.join(","),
        status: "pending",
      })
      .returning();

    // 2. Fetch or seed system prompt version
    let [promptVer] = await db.select().from(aiPromptVersion).limit(1);
    if (!promptVer) {
      const systemPrompt = `You are a highly capable AI assistant in an ERP system (slopware).
Analyze the user input and produce a structured, validatable JSON Execution Plan matching the required JSON Schema.
Your goal is to discover entities, fields, relationships, and commands dynamically based on the catalogs provided below.

Available Catalogs:
- Entity Catalog: lists allowed entities and their descriptions
- Field Catalog: lists dynamic semantic fields, types, and lookup tables
- Relationship Catalog: lists defaulting hierarchies and business relationships
- Command Catalog: lists available commands with input Zod schemas

Response constraints:
- Return ONLY valid JSON matching the schema. No markdown wrapping.
- For LOOKUP actions, populate 'candidateMatches' if matches can be inferred, or leave empty if ambiguous.
- Under 'fieldMappings', map properties to raw evidence text quotes.`;

      const [inserted] = await db
        .insert(aiPromptVersion)
        .values({
          systemPrompt,
          inputSchema: { type: "object", properties: { steps: { type: "array" } } },
          modelConfig: { model: "gemini/gemini-2.5-flash", temperature: 0.2 },
        })
        .returning();
      promptVer = inserted;
    }

    // 3. Resolve Dynamic Catalogs
    const entities = await AIDiscoveryService.getSemanticEntityCatalog(
      params.tenantId,
      params.taskScope,
    );
    const relationships = AIDiscoveryService.getSemanticRelationshipCatalog();
    const commands = await AIDiscoveryService.getSemanticCommandCatalog(
      params.tenantId,
      params.taskScope,
    );

    // Compile dynamic field catalog for all scoped entities
    const fieldsMap: Record<string, any> = {};
    for (const ent of entities) {
      fieldsMap[ent.entityName] = await AIDiscoveryService.getSemanticFieldCatalog(
        ent.entityName,
        params.tenantId,
      );
    }

    // 4. Retrieve and Decrypt LLM config with company-specific override and global fallback
    const [userRow] = await db
      .select({ lastCompanyId: schema.user.lastCompanyId })
      .from(schema.user)
      .where(eq(schema.user.id, params.userId))
      .limit(1);

    const activeCompanyId = userRow?.lastCompanyId;

    let gatewayUrl = "http://localhost:11435";
    let modelName = "gemini/gemini-2.5-flash";
    let _apiKey = "";

    let activeTenantConfig = null;
    if (activeCompanyId) {
      const configRows = await db
        .select()
        .from(schema.tenantLlmConfig)
        .where(
          and(
            eq(schema.tenantLlmConfig.tenantId, params.tenantId),
            eq(schema.tenantLlmConfig.companyId, activeCompanyId),
            eq(schema.tenantLlmConfig.isActive, true),
          ),
        )
        .limit(1);
      activeTenantConfig = configRows[0] || null;
    }

    if (activeTenantConfig) {
      gatewayUrl = activeTenantConfig.endpointUrl || "http://localhost:11435";
      modelName = activeTenantConfig.model || "gemini/gemini-2.5-flash";
      if (activeTenantConfig.apiKey) {
        const { decryptEmailCredentials } = await import("./email/credential-crypto");
        try {
          _apiKey = decryptEmailCredentials<string>(activeTenantConfig.apiKey);
        } catch {
          _apiKey = activeTenantConfig.apiKey;
        }
      }
    } else {
      const configRow = await db
        .select()
        .from(systemSettings)
        .where(and(eq(systemSettings.scope, "global"), eq(systemSettings.key, "llm_config")))
        .limit(1);

      gatewayUrl = configRow[0]
        ? (configRow[0].value as any).endpointUrl || "http://localhost:11435"
        : "http://localhost:11435";
      modelName = configRow[0]
        ? (configRow[0].value as any).model || "gemini/gemini-2.5-flash"
        : "gemini/gemini-2.5-flash";
      const encryptedKey = configRow[0] ? (configRow[0].value as any).apiKey : "";
      _apiKey = decryptSecret(encryptedKey);
    }

    // Assemble LLM prompt
    let customGuidelines = "";
    if (params.taskScope.includes("mail-classification")) {
      customGuidelines += `\n\n### Special Guidelines for mail-classification:\n- You MUST set "businessIntention" to one of the exact German values:\n  "Bestellung / Auftrag", "Angebotsanfrage", "Reklamation", "Liefertermin-/Statusanfrage", "Rechnung / Beleg", "Sonstiges / unklar".\n- Ensure you plan two steps:\n  - Step 1: A "LOOKUP" action for entity "address" to find the customer/business partner.\n  - Step 2: An "EXECUTE_COMMAND" action with 'commandKey' = "apply-ai-mail-classification" using "dependency:1" for 'relatedAddressId'.`;
    }
    if (params.taskScope.includes("mail-to-document-draft")) {
      customGuidelines += `\n\n### Special Guidelines for mail-to-document-draft:\n- Plan steps:\n  - Step 1: A "LOOKUP" action for entity "address" to find the customer/business partner.\n  - Step 2 (Optional): "LOOKUP" actions for entity "article" for any mentioned products/articles.\n  - Step 3: An "EXECUTE_COMMAND" action with 'commandKey' = "create-document-draft-from-ai-plan" using "dependency:1" for 'customerId'.`;
    }

    const prompt = `${promptVer.systemPrompt}${customGuidelines}

### Dynamic Discovery Catalogs:
1. Entities:
${JSON.stringify(entities, null, 2)}

2. Fields:
${JSON.stringify(fieldsMap, null, 2)}

3. Business Relationships & Defaults:
${JSON.stringify(relationships, null, 2)}

4. Available Commands:
${JSON.stringify(commands, null, 2)}

### Unstructured Raw Input Task:
"${params.rawInput}"`;

    let planJson: Record<string, any> = { steps: [] };
    let _promptTokens = 0;
    let _completionTokens = 0;

    try {
      const res = await fetch(`${gatewayUrl}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: modelName,
          endpoint_url: gatewayUrl,
        }),
      });

      if (!res.ok) throw new Error(`LLM completion route failed with status ${res.status}`);
      const body = (await res.json()) as {
        content: string;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const cleanContent = body.content
        .replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      planJson = JSON.parse(cleanContent);
      _promptTokens = body.usage?.prompt_tokens ?? 0;
      _completionTokens = body.usage?.completion_tokens ?? 0;
    } catch (e: any) {
      planJson = {
        taskId: run.runId,
        businessIntention: "Fehler bei der Inferenz",
        confidenceScore: 0,
        targetEntities: [],
        applyReadiness: "blocked",
        blockedReasons: [`LiteLLM call failed: ${e.message}`],
        steps: [],
      };
    }

    // 5. Stage the Generated Plan
    const [plan] = await db
      .insert(aiPlan)
      .values({
        tenantId: params.tenantId,
        runId: run.runId,
        promptVersionId: promptVer.promptVersionId,
        planJson,
        confidenceScore: String(planJson.confidenceScore ?? 1.0),
        applyReadiness: planJson.applyReadiness || "ready_for_review",
      })
      .returning();

    // Save Evidence
    if (Array.isArray(planJson.steps)) {
      for (const step of planJson.steps) {
        if (Array.isArray(step.fieldMappings)) {
          for (const mapping of step.fieldMappings) {
            await db.insert(aiEvidence).values({
              tenantId: params.tenantId,
              planId: plan.planId,
              fieldName: `${step.entityName}.${mapping.fieldName}`,
              sourceText: mapping.evidence || "",
              matchConfidence: String(mapping.confidence ?? 1.0),
              ambiguityNote: mapping.ambiguityReason || null,
            });
          }
        }
      }
    }

    // Update run duration and status
    await db
      .update(aiRun)
      .set({
        status: planJson.applyReadiness === "blocked" ? "failed" : "completed",
        durationMs: Date.now() - startTime,
      })
      .where(eq(aiRun.runId, run.runId));

    // Run dry-run validation
    const validation = await this.validatePlan(plan.planId, params.tenantId);

    return {
      planId: plan.planId,
      planJson,
      validation,
    };
  }

  /**
   * Performs deep business validation on the generated plan draft.
   */
  static async validatePlan(
    planId: string,
    tenantId: string,
  ): Promise<{ applyReadiness: string; warnings: string[]; blockedReasons: string[] }> {
    const [plan] = await db
      .select()
      .from(aiPlan)
      .where(and(eq(aiPlan.planId, planId), eq(aiPlan.tenantId, tenantId)))
      .limit(1);
    if (!plan) throw new Error("Plan not found");

    const planJson = plan.planJson as Record<string, any>;
    const steps = planJson.steps || [];
    const warnings: string[] = [];
    const blockedReasons: string[] = [];

    // Loop through steps to validate lookups, field structures, and command inputs
    for (const step of steps) {
      const { stepIndex, actionType, entityName } = step;

      // Assert physical schema exists
      const tableSchema = (schema as any)[entityName];
      if (!tableSchema) {
        blockedReasons.push(
          `Schritt ${stepIndex}: Entität '${entityName}' existiert nicht im Datenmodell.`,
        );
        continue;
      }

      if (actionType === "LOOKUP") {
        const criteria = step.lookupCriteria || {};
        const term = criteria.name || criteria.code || "";

        if (!term) {
          warnings.push(`Schritt ${stepIndex}: LOOKUP-Schritt hat leere Suchkriterien.`);
        } else {
          // Perform dynamic dry-run lookup in the database scoped by tenantId
          try {
            const columns = getColumns(tableSchema);
            const nameCol = columns.name || columns.code || columns.description;

            if (nameCol) {
              const matches = await db
                .select()
                .from(tableSchema)
                .where(
                  and(
                    eq((tableSchema as any).tenantId, tenantId),
                    sql`lower(${nameCol}) LIKE ${`%${String(term).toLowerCase()}%`}`,
                  ),
                )
                .limit(3);

              if (matches.length === 0) {
                warnings.push(
                  `Schritt ${stepIndex}: Keine passende Adresse oder Stammdaten für '${term}' gefunden.`,
                );
              } else if (matches.length > 1) {
                warnings.push(
                  `Schritt ${stepIndex}: Mehrere mögliche Treffer für '${term}' gefunden. Bitte manuell auflösen.`,
                );
                step.candidateMatches = matches.map((m: any) => ({
                  id: m[Object.keys(columns)[0]],
                  displayValue: m.name || m.code || "Unbekannt",
                  matchScore: 0.9,
                }));
              } else {
                // Single match
                step.candidateMatches = [
                  {
                    id: matches[0][Object.keys(columns)[0]],
                    displayValue: matches[0].name || matches[0].code || "Eindeutiger Treffer",
                    matchScore: 1.0,
                  },
                ];
              }
            }
          } catch {
            warnings.push(`Schritt ${stepIndex}: Fehler bei der Ausführung des Datenbank-Lookups.`);
          }
        }
      }

      if (actionType === "EXECUTE_COMMAND") {
        const payload = step.commandPayload || {};
        const commandKey = step.commandKey;

        // Perform schema matching dry-run
        const commandCatalog = await AIDiscoveryService.getSemanticCommandCatalog(tenantId, [
          "all",
        ]);
        const command = commandCatalog.find((c) => c.commandKey === commandKey);

        if (!command) {
          blockedReasons.push(
            `Schritt ${stepIndex}: Befehl '${commandKey}' ist nicht im Command-Katalog freigegeben.`,
          );
        } else {
          // Check payload requirements
          const required = command.inputSchema.required || [];
          for (const reqField of required) {
            if (payload[reqField] === undefined || payload[reqField] === null) {
              blockedReasons.push(
                `Schritt ${stepIndex}: Pflichtfeld '${reqField}' fehlt im Payload für Befehl '${commandKey}'.`,
              );
            }
          }
        }
      }
    }

    const applyReadiness =
      blockedReasons.length > 0
        ? "blocked"
        : warnings.length > 0
          ? "needs_user_input"
          : "ready_for_review";

    // Update plan status
    await db
      .update(aiPlan)
      .set({ applyReadiness })
      .where(and(eq(aiPlan.planId, planId), eq(aiPlan.tenantId, tenantId)));

    return {
      applyReadiness,
      warnings,
      blockedReasons,
    };
  }

  /**
   * Applies the plan by executing synchronous transactions and scheduling async jobs.
   */
  static async applyPlan(params: {
    planId: string;
    userOverrides: any;
    tenantId: string;
    userId: string;
  }): Promise<{ status: "success" | "failed"; errorLogs?: string; attemptId: string }> {
    const [plan] = await db
      .select()
      .from(aiPlan)
      .where(and(eq(aiPlan.planId, params.planId), eq(aiPlan.tenantId, params.tenantId)))
      .limit(1);
    if (!plan) throw new Error("Plan not found");

    const planJson = plan.planJson as Record<string, any>;
    const mergedPlan = { ...planJson, ...params.userOverrides };

    // 1. Create Apply Attempt
    const [attempt] = await db
      .insert(aiApplyAttempt)
      .values({
        tenantId: params.tenantId,
        planId: params.planId,
        appliedPlanJson: mergedPlan,
        status: "failed",
        executedByUserId: params.userId,
      })
      .returning();

    const stepResults = new Map<number, string>(); // Maps stepIndex -> generated UUID primary key
    const asyncJobsToEnqueue: { jobType: string; payload: any }[] = [];

    try {
      // Execute within a single database transaction boundary
      await db.transaction(async (tx) => {
        for (const step of mergedPlan.steps || []) {
          const { stepIndex, actionType, entityName } = step;

          // Helper to resolve dependency syntax (e.g. "dependency:1" -> resolves to the key generated in step 1)
          const resolveValue = (val: any): any => {
            if (typeof val === "string" && val.startsWith("dependency:")) {
              const depIndex = parseInt(val.split(":")[1], 10);
              const resolvedId = stepResults.get(depIndex);
              if (!resolvedId)
                throw new Error(
                  `Abhängigkeit zu Schritt ${depIndex} konnte nicht aufgelöst werden.`,
                );
              return resolvedId;
            }
            return val;
          };

          const tableSchema = (schema as any)[entityName];

          if (actionType === "LOOKUP") {
            // Check if user selected an override match
            const selectedMatchId =
              step.selectedMatchId || (step.candidateMatches && step.candidateMatches[0]?.id);
            if (!selectedMatchId)
              throw new Error(`Schritt ${stepIndex}: Lookup lieferte kein Ergebnis.`);
            stepResults.set(stepIndex, selectedMatchId);
          } else if (actionType === "PREPARE_UPSERT") {
            const mappings = step.fieldMappings || [];
            const insertValues: Record<string, any> = {
              tenantId: params.tenantId,
            };

            for (const map of mappings) {
              insertValues[map.fieldName] = resolveValue(map.proposedValue);
            }

            // Insert into local table
            const [inserted] = await tx.insert(tableSchema).values(insertValues).returning();

            const pkField = Object.keys(getColumns(tableSchema))[0];
            stepResults.set(stepIndex, (inserted as any)[pkField]);
          } else if (actionType === "EXECUTE_COMMAND") {
            const payload = { ...step.commandPayload };
            // Resolve payload dependency parameters
            for (const [key, val] of Object.entries(payload)) {
              payload[key] = resolveValue(val);
            }

            if (step.commandKey === "create-document-draft-from-ai-plan") {
              // Custom transactional local command handling: Create Document & lines
              const [doc] = await tx
                .insert((schema as any).document)
                .values({
                  tenantId: params.tenantId,
                  customerId: payload.customerId,
                  documentType: payload.docType || "Offer",
                  documentDirection: "outbound",
                  documentDate: new Date().toISOString(),
                  status: "draft",
                  documentGroupId: payload.documentGroupId || sql`null`,
                })
                .returning();

              if (Array.isArray(payload.lines)) {
                let lineSeq = 10;
                for (const line of payload.lines) {
                  await tx.insert((schema as any).documentLine).values({
                    tenantId: params.tenantId,
                    documentId: doc.documentId,
                    lineNo: lineSeq,
                    articleId: line.articleId,
                    quantity: String(line.quantity || 1),
                    netPrice: String(line.priceOverride || 0),
                  });
                  lineSeq += 10;
                }
              }
              stepResults.set(stepIndex, doc.documentId);
            } else if (step.commandKey === "create-address-from-ai-plan") {
              // Create Address draft
              const [addr] = await tx
                .insert((schema as any).address)
                .values({
                  tenantId: params.tenantId,
                  name: payload.name,
                  isCustomer: payload.isCustomer !== false,
                  isSupplier: payload.isSupplier === true,
                  email: payload.email || null,
                  phone: payload.phone || null,
                  street: payload.street || null,
                  city: payload.city || null,
                  postalCode: payload.postalCode || null,
                })
                .returning();
              stepResults.set(stepIndex, addr.addressId);
            } else if (step.commandKey === "apply-ai-mail-classification") {
              const payload = { ...step.commandPayload };
              // Resolve payload dependency parameters
              for (const [key, val] of Object.entries(payload)) {
                payload[key] = resolveValue(val);
              }
              if (!payload.emailThreadId)
                throw new Error("apply-ai-mail-classification requires emailThreadId");

              const [updatedThread] = await tx
                .update((schema as any).emailThread)
                .set({
                  relatedAddressId: payload.relatedAddressId || null,
                  relatedDocumentId: payload.relatedDocumentId || null,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq((schema as any).emailThread.emailThreadId, payload.emailThreadId),
                    eq((schema as any).emailThread.tenantId, params.tenantId),
                  ),
                )
                .returning({ emailThreadId: (schema as any).emailThread.emailThreadId });
              if (!updatedThread) {
                throw new Error("apply-ai-mail-classification could not update the email thread");
              }

              stepResults.set(stepIndex, payload.emailThreadId);
            } else {
              // Standard domain commands that might fall outside simple synchronous writes
              // (e.g. calling an external service) are scheduled for asynchronous job execution
              asyncJobsToEnqueue.push({
                jobType: step.commandKey,
                payload: {
                  tenantId: params.tenantId,
                  userId: params.userId,
                  ...payload,
                },
              });
            }
          }
        }
      });

      // 2. Schedule Asynchronous background jobs outside transaction boundaries
      for (const job of asyncJobsToEnqueue) {
        await db.insert(emailJob).values({
          tenantId: params.tenantId,
          jobType: "reconcile", // Maps to general worker retry framework
          idempotencyKey: `ai-apply-${attempt.attemptId}-${job.jobType}`,
          payload: {
            aiExecutionCommand: job.jobType,
            ...job.payload,
          },
          status: "queued",
        });
      }

      // Mark Apply attempt as successful
      await db
        .update(aiApplyAttempt)
        .set({ status: "success" })
        .where(eq(aiApplyAttempt.attemptId, attempt.attemptId));

      return {
        status: "success",
        attemptId: attempt.attemptId,
      };
    } catch (e: any) {
      // Update attempt with failure logs
      await db
        .update(aiApplyAttempt)
        .set({
          status: "failed",
          errorLogs: e.message,
        })
        .where(eq(aiApplyAttempt.attemptId, attempt.attemptId));

      return {
        status: "failed",
        errorLogs: e.message,
        attemptId: attempt.attemptId,
      };
    }
  }
}
