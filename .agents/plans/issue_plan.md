# Open Issues Implementation Plan

## Dependency Graph

```
Wave 1 (DB Schema):   #35 → #47 → #57
Wave 2 (DB Utils):    #24, #25, #26  (independent, can run in parallel)
Wave 3 (Agent):       #41, #37, #38, #39, #40  (after Wave 1)
Wave 4 (Read Tools):  #42, #43, #44, #45  (after Wave 3 #40)
Wave 5 (Mutations):   #48, #49, #50, #51  (after Wave 4)
Wave 6 (UI):          #52, #53, #54, #55, #56, #58  (after Wave 5)
```

## Issue List

| #   | Title                                                             | Wave | Subagent        |
| --- | ----------------------------------------------------------------- | ---- | --------------- |
| #35 | DB Schema — ai_session + ai_turn + ai_tool_call Migration         | 1    | db-schema-1     |
| #47 | DB Schema — ai_review + ai_context_projection Migration           | 1    | db-schema-1     |
| #57 | DB Schema — ai_memory Tabelle                                     | 1    | db-schema-1     |
| #24 | DB: Reconciliation-Report für Metadata-Sync                       | 2    | db-utils        |
| #25 | DB: entfernte tenant_fields als archived markieren                | 2    | db-utils        |
| #26 | DB: migrate-Script um Metadata-Schritte erweitern                 | 2    | db-utils        |
| #41 | LiteLLM Python Service entfernen + LLM-Config Migration           | 3    | agent-infra     |
| #37 | Context Projection Builder — mail_thread + document               | 3    | agent-context   |
| #38 | Context Projection Builder — address + article + editor_selection | 3    | agent-context   |
| #39 | SSE Endpoint Setup + Event Protocol                               | 3    | agent-sse       |
| #40 | SSE Tool Dispatch Loop + DB-Persistenz                            | 3    | agent-sse       |
| #42 | Mail Read Tools                                                   | 4    | agent-tools     |
| #43 | Document Read Tools                                               | 4    | agent-tools     |
| #44 | Address Read Tools                                                | 4    | agent-tools     |
| #45 | Article Tools                                                     | 4    | agent-tools     |
| #48 | Mail Mutation Tool                                                | 5    | agent-mutations |
| #49 | Document Mutation Tools                                           | 5    | agent-mutations |
| #50 | Address Mutation Tool                                             | 5    | agent-mutations |
| #51 | Review Validate + Apply Endpoints                                 | 5    | agent-mutations |
| #52 | AiOverlayHost — Session-Start + SSE-Stream Anbindung              | 6    | ui-overlay      |
| #53 | AiOverlayHost — Review-Panel + Validate/Apply UI                  | 6    | ui-overlay      |
| #54 | Alt+A Command auf alle Module erweitern                           | 6    | ui-overlay      |
| #55 | Floating Toolbar Komponente für Inline-Editor-Tools               | 6    | ui-inline       |
| #56 | Inline Editor Tools                                               | 6    | ui-inline       |
| #58 | Auto-Extraktion von Memory-Hints + Bestätigungs-UI                | 6    | ui-memory       |
