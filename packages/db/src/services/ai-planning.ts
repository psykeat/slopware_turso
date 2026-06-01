import { createDecipheriv, randomUUID } from "crypto";

import { and, eq, sql, getColumns } from "drizzle-orm";

const DOC_TYPE_MAP: Record<string, string> = {
  Offer: "N",
  Order: "A",
  DeliveryNote: "L",
  Invoice: "R",
};

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

function inferProvider(model: string, provider?: string): string {
  if (model.startsWith("vertex_ai/")) return "vertex_ai";
  if (model.startsWith("gemini/")) return "google_ai_studio";
  if (provider) return provider;
  return "openai";
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
    let providerName = "google_ai_studio";
    let _apiKey = "";
    let _githubToken = "";
    let _githubRepo = "";
    let _vertexCredentials = "";
    let _vertexProject = "";
    let _vertexLocation = "";

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
      providerName = inferProvider(modelName, (activeTenantConfig as any).provider);
      if (activeTenantConfig.apiKey) {
        const { decryptEmailCredentials } = await import("./email/credential-crypto");
        try {
          _apiKey = decryptEmailCredentials<string>(activeTenantConfig.apiKey);
        } catch {
          _apiKey = activeTenantConfig.apiKey;
        }
      }
      if ((activeTenantConfig as any).githubToken) {
        const { decryptEmailCredentials } = await import("./email/credential-crypto");
        try {
          _githubToken = decryptEmailCredentials<string>((activeTenantConfig as any).githubToken);
        } catch {
          _githubToken = (activeTenantConfig as any).githubToken;
        }
      }
      _githubRepo = (activeTenantConfig as any).githubRepo ?? "";
      _vertexCredentials = decryptSecret((activeTenantConfig as any).vertexCredentials ?? "");
      _vertexProject = (activeTenantConfig as any).vertexProject ?? "";
      _vertexLocation = (activeTenantConfig as any).vertexLocation ?? "";
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
      providerName = inferProvider(
        modelName,
        configRow[0] ? (configRow[0].value as any).provider : undefined,
      );
      _vertexCredentials = decryptSecret(
        configRow[0] ? (configRow[0].value as any).vertexCredentials : "",
      );
      _vertexProject = configRow[0] ? ((configRow[0].value as any).vertexProject ?? "") : "";
      _vertexLocation = configRow[0] ? ((configRow[0].value as any).vertexLocation ?? "") : "";
      const encryptedKey = configRow[0] ? (configRow[0].value as any).apiKey : "";
      _apiKey = decryptSecret(encryptedKey);
    }

    // Pre-process rawInput: parse structured thread context if present
    let parsedInput: Record<string, any> = {};
    let threadContextSection = "";
    try {
      parsedInput = JSON.parse(params.rawInput);
      if (parsedInput.threadSubject || parsedInput.relatedDocumentId != null) {
        const lines: string[] = [];
        lines.push(`Thread Subject: ${parsedInput.threadSubject || "(no subject)"}`);
        if (parsedInput.relatedDocumentId) {
          lines.push(
            `Already linked to Document ID: ${parsedInput.relatedDocumentId} (this thread has a known document link — do NOT create a duplicate)`,
          );
        } else {
          lines.push("Thread is not yet linked to any document.");
        }
        if (parsedInput.relatedAddressId) {
          lines.push(`Already linked to Address ID: ${parsedInput.relatedAddressId}`);
        }
        // Detect outbound messages in the thread (we sent something)
        const contentLines = (parsedInput.content || "").split("\n");
        const hasOutbound = contentLines.some((l: string) => l.startsWith("[OUTBOUND]"));
        if (hasOutbound) {
          lines.push(
            "This thread contains at least one OUTBOUND message (sent by us). An inbound reply in this thread likely responds to that message.",
          );
        }
        threadContextSection = `\n\n### Structured Thread Context (use this first — it is authoritative):\n${lines.join("\n")}`;
      }
    } catch {
      // rawInput is not JSON or lacks structured context — continue as-is
    }

    // Assemble LLM prompt
    let customGuidelines = "";
    if (params.taskScope.includes("mail-classification")) {
      customGuidelines += `\n\n### Special Guidelines for mail-classification:
- You MUST evaluate the email and set "businessIntention" to one of the exact German values:
  - "Bestellung / Auftrag": Only if the customer explicitly orders articles, services, or accepts/orders a quote.
  - "Angebotsanfrage": Only if the customer is requesting an offer/quote/price information for articles or services.
  - "Reklamation": Only if the customer is reporting a complaint, fault, or issue with a delivery or invoice.
  - "Liefertermin-/Statusanfrage": Only if the customer is asking about shipping dates, delivery times, or tracking info.
  - "Rechnung / Beleg": Only if the email contains or requests invoices, receipts, or credit notes.
  - "Sonstiges / unklar": Use this if none of the above fits, or if the email content is vague, short, or does not clearly communicate one of the intentions.
- Evaluate the 'confidenceScore' realistically:
  - Do NOT set the score to 1.0 unless the content is absolutely unambiguous.
  - If the email is vague, short, or classified as "Sonstiges / unklar", set the score conservatively between 0.2 and 0.5.
  - If the thread context confirms a prior document link or outbound message, you may be more confident.
- Ensure you plan two steps for classification:
  - Step 1: A "LOOKUP" action for entity "address" to find the customer/business partner.
  - Step 2: An "EXECUTE_COMMAND" action with 'commandKey' = "apply-ai-mail-classification" using "dependency:1" for 'relatedAddressId'.`;
    }
    if (params.taskScope.includes("mail-to-document-draft")) {
      customGuidelines += `\n\n### Special Guidelines for mail-to-document-draft:
- Strict Intention-Based Execution Rules (Anti-AI-Slop Policy):
  - You MUST NOT plan any document creation ("create-document-draft-from-ai-plan") or document conversion ("convert-document-from-ai-plan") commands if the businessIntention is "Sonstiges / unklar", "Reklamation", "Liefertermin-/Statusanfrage", or if the email is otherwise unrelated to a transaction. Suggesting transactions for general queries is considered severe AI slop.
  - Only plan a document draft or conversion if the intent is clearly "Bestellung / Auftrag" or "Angebotsanfrage".
- Plan steps based on the user's intent:
  - CASE A: The customer wants to receive a new Offer/Quote or similar (Creating a new document draft from scratch):
    - Step 1: A "LOOKUP" action for entity "address" to find the customer.
    - Step 2 (Optional): "LOOKUP" actions for entity "article" for any mentioned products/articles.
    - Step 3: An "EXECUTE_COMMAND" action with 'commandKey' = "create-document-draft-from-ai-plan" using "dependency:1" for 'customerId' and "Offer" for 'docType'.
    - Step 4: An "EXECUTE_COMMAND" action with 'commandKey' = "apply-ai-mail-classification" using "dependency:1" for 'relatedAddressId' and "dependency:3" for 'relatedDocumentId'.
  - CASE B: The customer is ordering/accepting an existing Offer/Quote. Triggers when:
    - The email body or thread subject contains a document reference like ANG-XXXXXX, or refers to "your offer", "das Angebot", "Bestellung des Angebots", etc.
    - OR the thread subject follows the pattern "[CompanyName]: N ANG-XXXXXX" (which is the standard offer email subject format used by this system).
    - OR the thread contains an OUTBOUND message (we sent an offer) and the inbound reply indicates acceptance.
    - Plan:
      - Step 1: A "LOOKUP" action for entity "address" to find the customer.
      - Step 2: A "LOOKUP" action for entity "document" to find the existing Offer (Angebot) being ordered. Extract the document number from the thread subject or body (e.g. 'ANG-000002') and use lookupCriteria with 'code' set to that number.
      - Step 3: An "EXECUTE_COMMAND" action with 'commandKey' = "convert-document-from-ai-plan" using "dependency:2" for 'sourceDocumentId' and "Order" for 'targetDocType'.
      - Step 4: An "EXECUTE_COMMAND" action with 'commandKey' = "apply-ai-mail-classification" using "dependency:1" for 'relatedAddressId' and "dependency:3" for 'relatedDocumentId'.`;
    }

    const prompt = `${promptVer.systemPrompt}${customGuidelines}${threadContextSection}

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
          provider: providerName,
          api_key: _apiKey || undefined,
          github_token: _githubToken || undefined,
          github_repo: _githubRepo || undefined,
          vertex_credentials: _vertexCredentials || undefined,
          vertex_project: _vertexProject || undefined,
          vertex_location: _vertexLocation || undefined,
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
      const rawPlanJson = JSON.parse(cleanContent);
      planJson = this.normalizePlanJson(rawPlanJson);
      planJson._llmTrace = {
        prompt,
        response: body.content,
        model: modelName,
        usage: body.usage,
      };
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

    // Load final mutated plan from database
    const [finalPlan] = await db
      .select({ planJson: aiPlan.planJson })
      .from(aiPlan)
      .where(eq(aiPlan.planId, plan.planId))
      .limit(1);

    return {
      planId: plan.planId,
      planJson: finalPlan?.planJson || planJson,
      validation,
    };
  }

  /**
   * Helper to normalize plan JSON produced by the LLM into a standard shape.
   */
  static normalizePlanJson(raw: any): any {
    if (!raw || typeof raw !== "object") {
      return { steps: [], businessIntention: "Sonstiges / unklar", confidenceScore: 0.1 };
    }

    const result: any = { ...raw };

    // Support 'executionPlan' or 'plan' keys as fallbacks for 'steps'
    let rawSteps = raw.steps || raw.executionPlan || raw.plan || [];
    if (!Array.isArray(rawSteps) && typeof rawSteps === "object") {
      rawSteps = Object.values(rawSteps);
    }
    if (!Array.isArray(rawSteps)) {
      rawSteps = [];
    }

    result.steps = rawSteps.map((step: any, index: number) => {
      if (!step || typeof step !== "object") return step;
      const normalized: any = { ...step };

      // Normalize step index / ID
      normalized.stepIndex = step.stepIndex ?? step.stepId ?? step.step ?? index + 1;

      // Normalize action type (e.g. LOOKUP, EXECUTE_COMMAND)
      let rawAction = step.actionType ?? step.type ?? step.action;
      if (typeof rawAction === "string") {
        rawAction = rawAction.toUpperCase();
        if (rawAction === "COMMAND" || rawAction === "EXECUTE") {
          rawAction = "EXECUTE_COMMAND";
        }
      }
      normalized.actionType = rawAction;

      // Normalize command payload / inputs
      normalized.commandPayload = step.commandPayload ?? step.commandInput ?? step.parameters ?? {};

      // Ensure candidates and lookup criteria arrays/objects exist
      normalized.candidateMatches = step.candidateMatches || [];
      normalized.lookupCriteria = step.lookupCriteria || {};

      return normalized;
    });

    // Normalize high-level metadata
    result.businessIntention = raw.businessIntention || raw.intention || "Sonstiges / unklar";

    let score = raw.confidenceScore ?? raw.confidence ?? raw.score;
    if (typeof score === "string") {
      score = parseFloat(score);
    }
    if (typeof score !== "number" || isNaN(score)) {
      score = 0.5;
    }
    result.confidenceScore = score;

    result.applyReadiness = raw.applyReadiness || "ready_for_review";
    result.blockedReasons = raw.blockedReasons || [];

    return result;
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

        // Perform dynamic dry-run lookup in the database scoped by tenantId
        try {
          const columns = getColumns(tableSchema);
          const lookupConditions: any[] = [];

          // 1. Try to match criteria keys to actual columns
          for (const [key, val] of Object.entries(criteria)) {
            if (columns[key] && val) {
              let mappedVal = "";
              if (typeof val === "string") {
                mappedVal = val;
              } else if (typeof val === "number" || typeof val === "boolean") {
                mappedVal = val.toString();
              } else {
                mappedVal = JSON.stringify(val);
              }
              if (key === "documentType" && DOC_TYPE_MAP[val as string]) {
                mappedVal = DOC_TYPE_MAP[val as string];
              }
              lookupConditions.push(
                sql`lower(${columns[key]}) LIKE ${`%${mappedVal.toLowerCase()}%`}`,
              );
            }
          }

          // Address-specific email lookup routing through addressContact
          if (entityName === "address" && criteria.email) {
            const contacts = await db
              .select({ addressId: schema.addressContact.addressId })
              .from(schema.addressContact)
              .where(
                and(
                  eq(schema.addressContact.tenantId, tenantId),
                  sql`lower(${schema.addressContact.email}) = ${String(criteria.email).toLowerCase()}`,
                ),
              )
              .limit(1);

            if (contacts.length > 0) {
              lookupConditions.push(eq(columns.addressId, contacts[0].addressId));
            }
          }

          // 2. Fallback to generic name/code search if no columns matched
          if (lookupConditions.length === 0) {
            const term =
              criteria.name || criteria.code || criteria.email || Object.values(criteria)[0] || "";
            if (term) {
              const nameCol =
                columns.companyName ||
                columns.name ||
                columns.code ||
                columns.description ||
                columns.documentNo ||
                columns.email;
              if (nameCol) {
                lookupConditions.push(
                  sql`lower(${nameCol}) LIKE ${`%${String(term).toLowerCase()}%`}`,
                );
              }
            }
          }

          if (lookupConditions.length === 0) {
            warnings.push(`Schritt ${stepIndex}: LOOKUP-Schritt hat leere Suchkriterien.`);
          } else {
            const matches = await db
              .select()
              .from(tableSchema)
              .where(and(eq((tableSchema as any).tenantId, tenantId), ...lookupConditions))
              .limit(3);

            const criteriaDesc =
              Object.entries(criteria)
                .map(([k, v]) => `${k}: ${v as any}`)
                .join(", ") || "Suchbegriff";

            if (matches.length === 0) {
              warnings.push(
                `Schritt ${stepIndex}: Keine passende Adresse oder Stammdaten für '${criteriaDesc}' gefunden.`,
              );
              step.candidateMatches = [];
            } else if (matches.length > 1) {
              warnings.push(
                `Schritt ${stepIndex}: Mehrere mögliche Treffer für '${criteriaDesc}' gefunden. Bitte manuell auflösen.`,
              );
              step.candidateMatches = matches.map((m: any) => ({
                id: m[Object.keys(columns)[0]],
                displayValue: m.companyName || m.name || m.code || m.documentNo || "Unbekannt",
                matchScore: 0.9,
              }));
            } else {
              // Single match
              step.candidateMatches = [
                {
                  id: matches[0][Object.keys(columns)[0]],
                  displayValue:
                    matches[0].companyName ||
                    matches[0].name ||
                    matches[0].code ||
                    matches[0].documentNo ||
                    "Eindeutiger Treffer",
                  matchScore: 1.0,
                },
              ];
            }
          }
        } catch {
          warnings.push(`Schritt ${stepIndex}: Fehler bei der Ausführung des Datenbank-Lookups.`);
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
      .set({ applyReadiness, planJson })
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
              const mappedType = DOC_TYPE_MAP[payload.docType] || payload.docType || "N";

              // Resolve the document group for the mappedType
              const [grp] = await tx
                .select()
                .from((schema as any).documentGroup)
                .where(
                  and(
                    eq((schema as any).documentGroup.tenantId, params.tenantId),
                    eq((schema as any).documentGroup.documentType, mappedType),
                    eq((schema as any).documentGroup.archived, false),
                  ),
                )
                .limit(1);

              if (!grp) {
                throw new Error(`Keine Beleggruppe für den Typ ${payload.docType} gefunden.`);
              }

              // Resolve companyId and warehouseId
              let companyId = grp.companyId;
              let resolvedWarehouseId = grp.defaultWarehouseId;

              if (!companyId) {
                const [co] = await tx
                  .select({
                    companyId: (schema as any).company.companyId,
                    defaultWarehouseId: (schema as any).company.defaultWarehouseId,
                  })
                  .from((schema as any).company)
                  .where(eq((schema as any).company.tenantId, params.tenantId))
                  .limit(1);
                if (co) {
                  companyId = co.companyId;
                  if (!resolvedWarehouseId) resolvedWarehouseId = co.defaultWarehouseId;
                }
              }

              if (!companyId) {
                throw new Error("Keine aktive Firma für diesen Mandanten gefunden.");
              }

              // Generate documentNo from sequence
              let documentNo = `DRAFT-${Date.now()}`;
              if (grp.numberSequenceId) {
                const [seq] = await tx
                  .select()
                  .from((schema as any).numberSequence)
                  .where(eq((schema as any).numberSequence.numberSequenceId, grp.numberSequenceId))
                  .limit(1)
                  .for("update");

                if (seq) {
                  const padLen = Math.max(0, seq.padding - String(seq.nextValue).length);
                  documentNo = seq.prefix + "0".repeat(padLen) + seq.nextValue;
                  await tx
                    .update((schema as any).numberSequence)
                    .set({ nextValue: seq.nextValue + 1, updatedAt: new Date() })
                    .where(
                      eq((schema as any).numberSequence.numberSequenceId, seq.numberSequenceId),
                    );
                }
              }

              const [doc] = await tx
                .insert((schema as any).document)
                .values({
                  tenantId: params.tenantId,
                  companyId,
                  customerId: payload.customerId,
                  documentType: mappedType,
                  documentNo,
                  documentDirection: grp.direction || "OUTBOUND",
                  documentDate: new Date().toISOString().slice(0, 10),
                  status: "draft",
                  documentGroupId: grp.documentGroupId,
                  transactionId: randomUUID(),
                  warehouseId: resolvedWarehouseId,
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
            } else if (step.commandKey === "convert-document-from-ai-plan") {
              if (!payload.sourceDocumentId) {
                throw new Error("convert-document-from-ai-plan requires sourceDocumentId");
              }

              const { DocumentService } = await import("./document-service");
              const docSvc = new DocumentService();

              let targetGroupId = payload.targetGroupId;
              if (!targetGroupId) {
                const candidates = await docSvc.getConversionCandidates(
                  payload.sourceDocumentId,
                  params.tenantId,
                );
                if (candidates.length === 0) {
                  throw new Error("Keine Zielgruppe für die Wandlung dieses Belegs gefunden.");
                }
                const candidate = payload.targetDocType
                  ? candidates.find(
                      (c) =>
                        c.documentType.toLowerCase() ===
                        DOC_TYPE_MAP[payload.targetDocType]?.toLowerCase(),
                    ) || candidates[0]
                  : candidates[0];
                targetGroupId = candidate.documentGroupId;
              }

              const result = await docSvc.convertDocument(
                payload.sourceDocumentId,
                params.userId,
                params.tenantId,
                targetGroupId,
              );

              if (!result.success || !result.newDocumentId) {
                throw new Error("Fehler bei der Belegwandlung.");
              }

              stepResults.set(stepIndex, result.newDocumentId);
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
