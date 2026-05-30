# AI Base API & Stateless Schema Discovery Architecture (V2)

## Purpose

This document specifies the stateless, metadata-driven **AI Base API (V2)** in slopware. It bridges unstructured raw business inputs (emails, OCR texts, PDF Lieferscheine) with slopware's authoritative relational core, leveraging **LiteLLM** as the provider-agnostic gateway and **Gemini** as the primary intelligence model. The front-end overlay shell that consumes these contracts is intentionally out of scope here.

---

## 1. Core Position: Stateless & Context-Bounded Discovery

The AI Base API operates under a strict stateless model. It does not store conversational history within the LLM proxy layer. Instead, it generates context-bounded, tenant-scoped semantic metadata catalogs on-the-fly, which are fed into the prompt payload.

### Invariants:

1. **Server-Owned Isolation**: The active `tenantId` is always resolved server-side from the authenticated session context. No client, UI, or LLM payload can override or supply this value.
2. **Scope Policies**: A task-specific **Scope Policy** limits the entities, fields, and commands visible to the LLM. This prevents prompt pollution and ensures compliance with the user's role-based access.
3. **No Direct Writes**: LLM planning outputs are mapped strictly to domain commands (`entity_commands`) and domain services. Raw SQL executions or generic CRUD injections by the AI are categorically forbidden.
4. **Server-Side Contract Boundary**: `plan`, `validate`, and `apply` are server contracts. They return structured plans, validate them against domain rules, and execute them through controlled domain paths; they do not define or own the UI shell.

---

## 2. API Split & Discovery Routing

The API is divided into logical discovery, planning, validation, and execution layers to ensure clear boundaries. These are server-side contracts only; a client may render a shared overlay host, but the shell itself is not part of this specification:

```
                  +-------------------------------------------------+
                  |                   AI API Gateway                |
                  +-------+-----------------+---------------+-------+
                          |                 |               |
                +---------v-------+ +-------v-------+ +-----v-----+
                |  Discovery API  | |  Planning API | | Apply API |
                +-----------------+ +---------------+ +-----------+
```

### Endpoints:

- `GET /api/ai/catalog/entities`: Lists allowed entities under the current Scope Policy.
- `GET /api/ai/catalog/entities/:entityName`: Semantically lists fields, lookups, and business relations for a specific entity.
- `GET /api/ai/catalog/commands`: Lists permitted `entity_commands` for the current scope.
- `POST /api/ai/catalog/context`: Compiles custom, active lookup references or defaulting hints (e.g. current tax codes, unit definitions) into an LLM-consumable schema.
- `POST /api/ai/plan`: Accepts unstructured raw text and generates an unvalidated draft plan.
- `POST /api/ai/plans/:planId/validate`: Triggers a comprehensive dry-run business validation.
- `POST /api/ai/plans/:planId/apply`: Transactionally executes the plan steps through controlled domain services, supporting synchronous writes and scheduling asynchronous jobs.

---

## 3. Dynamic Catalogs & Relationship Defaulting

To make the AI structurally competent, the `MetadataResolver` compiles four catalogs that contain business-level metadata instead of technical database representations.

### Relationship & Defaulting Catalog

Unlike a standard physical Foreign Key mapping, the relationship catalog provides rich semantic connections and default derivation rules:

- **`customer of document`**: Relates `document.customerId` to the `address` entity where `isCustomer = true`.
- **`default delivery address`**: Maps the default delivery relation (`address.defaultDeliveryAddressId` -> `deliveryAddress`).
- **`payment term derivation`**: Informs the AI that the payment term defaults from the company setting, then from the address record, and is finally stored in the document.
- **`article group nesting`**: Defines how `article` classifies under `articleGroup` hierarchies.

---

## 4. Rich Planning JSON Model with Evidence & Readiness

The planning JSON returned by Gemini via LiteLLM must contain explicit verification parameters to empower the client-side review surface:

```json
{
  "taskId": "string",
  "businessIntention": "string",
  "confidenceScore": 0.96,
  "targetEntities": ["address", "document"],
  "applyReadiness": "ready_for_review",
  "blockedReasons": [],
  "steps": [
    {
      "stepIndex": 1,
      "actionType": "LOOKUP",
      "entityName": "address",
      "description": "Lookup the customer 'Müller GmbH'",
      "lookupCriteria": { "name": "Müller GmbH" },
      "evidence": "Wir haben eine Bestellung von der Firma Müller GmbH erhalten.",
      "candidateMatches": [
        {
          "id": "019e2889-5cd7-714b-9922-08a75fdfbaac",
          "displayValue": "Müller GmbH (Hamburg)",
          "matchScore": 0.95
        }
      ],
      "ambiguities": [],
      "requiredUserInputs": []
    },
    {
      "stepIndex": 2,
      "actionType": "EXECUTE_COMMAND",
      "entityName": "document",
      "description": "Erzeuge ein Angebot für Müller GmbH",
      "commandKey": "create-document-draft-from-ai-plan",
      "commandPayload": {
        "customerId": "dependency:1",
        "docType": "Offer",
        "lines": [
          {
            "articleId": "lookup:article_id",
            "quantity": 10
          }
        ]
      },
      "evidence": "Bitte schicken Sie uns ein Angebot über 10 Stück.",
      "candidateMatches": [],
      "ambiguities": [],
      "requiredUserInputs": []
    }
  ]
}
```

---

## 5. Execution Boundaries: Synchronous vs. Asynchronous Jobs

Not all execution steps can run in a single blocking database transaction. The execution model divides plan execution:

```
                            +--------------------------+
                            |     POST /apply Plan     |
                            +------------+-------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
            +----------v----------+             +----------v----------+
            |  Synchronous Steps  |             |  Asynchronous Jobs  |
            +----------+----------+             +----------+----------+
                       |                                   |
            +----------v----------+             +----------v----------+
            | Local DB Transaction|             |  Idempotent Worker  |
            |   (Rollback on Err) |             |    (emailJob Model) |
            +---------------------+             +---------------------+
```

1. **Synchronous Steps (Local DB Writes)**:
   - Operations like creating customer drafts, storing address contacts, or saving documents are bundled inside a single transaction with a rollback on any validation failure.
2. **Asynchronous Jobs (External & Heavy Operations)**:
   - Tasks that require external I/O (e.g. generating PDFs, syncing external provider accounts, downloading attachments) are dispatched to the slopware **DB-backed Job Queue** (`emailJob` model framework), featuring exponential backoff, retry monitoring, and idempotency keys.

---

## 6. Business Validation (Dry-Run)

The dry-run validation does not stop at simple ORM-level type checks. It performs deep business logic inspection:

- **Effective Metadata Validation**: Validates fields against requiredness, visibility rules, and readonly restrictions compiled by `MetadataResolver`.
- **Command Dry-Runs**: Executes dry-run validators inside targeted command handlers to check posting conditions, permission thresholds, and operational constraints without committing changes.
- **Domain Service Checks**: Validates business structures (such as matching invoice line totals and calculating VAT rates) via domain-level validation hooks in `DocumentService` or `EmailSendService`.

---

## 7. Audit Subsystem Structure

To allow full replayability, pricing auditing, and prompt performance analysis, a multi-table auditing system is established:

1. **`ai_run`**: Tracks the overall session execution.
   - `runId`, `tenantId`, `userId`, `taskScope`, `status`, `durationMs`.
2. **`ai_prompt_version`**: Version controls the system prompt, instructions, and schemas sent to LiteLLM.
   - `promptVersionId`, `systemPrompt`, `inputSchema`, `modelConfig`.
3. **`ai_plan`**: Stages the structured plans generated by the LLM.
   - `planId`, `runId`, `promptVersionId`, `planJson`, `confidenceScore`, `applyReadiness`.
4. **`ai_apply_attempt`**: Tracks user execution attempts and modifications.
   - `attemptId`, `planId`, `appliedPlanJson` (user overrides included), `status`, `executedByUserId`, `errorLogs`, `appliedAt`.
5. **`ai_evidence`**: Persists the link between generated fields and source citations.
   - `evidenceId`, `planId`, `fieldName`, `sourceText`, `matchConfidence`, `ambiguityNote`.
6. **`tenant_llm_config`**: Stores tenant-scoped, company-specific LLM gateway overrides.
   - `tenantLlmConfigId`, `tenantId`, `companyId`, `endpointUrl`, `model`, `apiKey` (encrypted), `isActive`.

---

## 8. LiteLLM Gateway & Resilience Policies

When making completions through the LiteLLM proxy:

- **Response Validation**: Compulsory validation of the completion output against the JSON planning schema.
- **Retry Policy**: Up to 3 automatic retries if the LLM output violates the required JSON schema structure.
- **Fallback Policy**: Graceful fallback strategies if `finish_reason = 'length'` is encountered (e.g., truncating history or routing to `gemini-2.5-pro` with larger context lengths).
- **Budget Boundaries**: Strict API key budgets, query rate limits, and latency telemetry tracked at the Gateway layer.

---

## 9. Multi-Tenant Override & Fallback Hierarchy

To support large enterprise groups with customized LLM proxies (BYOK), slopware resolves configuration at runtime using a tiered hierarchy:

```
                  +---------------------------------------+
                  |  Resolve Current User Active Company  |
                  |        (user.lastCompanyId)           |
                  +-------------------+-------------------+
                                      |
                        +-------------v-------------+
                        |   Has Active custom       |
                        |   tenant_llm_config?      |
                        +------+-------------+------+
                               |             |
                         Yes   |             |   No
                  +------------v---+     +---v------------+
                  | Custom Gateway |     | Global Base    |
                  | (Decrypt Key)  |     | systemSettings |
                  +----------------+     +----------------+
```

1. **Active Company Scoping**: Retrieves the user's active workspace session (`user.lastCompanyId`).
2. **Mandanten-KI-Konfiguration (Custom Override)**: Searches for an active `tenant_llm_config` matching the company. If configured:
   - Uses the custom LiteLLM `endpointUrl` and `model` (e.g. customized OpenAI or local models).
   - Decrypts the custom `apiKey` transparently at the service boundary.
3. **Global Base (Fallback)**: If no active company-scoped override is found, the gateway falls back to the global `systemSettings` `llm_config` credentials configured by the slopware platform operator.
