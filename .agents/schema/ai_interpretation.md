# Table: `ai_interpretation`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| interpretation_id | interpretation_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| source_thread_id | source_thread_id | uuid | — |  |  |
| run_id | run_id | uuid | — | NOT NULL |  |
| prompt_version_id | prompt_version_id | uuid | — | NOT NULL |  |
| business_intent | business_intent | text | — | NOT NULL |  |
| confidence_score | confidence_score | numeric | — | NOT NULL |  |
| summary | summary | text | — | NOT NULL |  |
| evidence_json | evidence_json | jsonb | — | NOT NULL |  |
| extracted_references_json | extracted_references_json | jsonb | — | NOT NULL |  |
| requested_resolvers_json | requested_resolvers_json | jsonb | — | NOT NULL |  |
| blocking_questions_json | blocking_questions_json | jsonb | — | NOT NULL |  |
| raw_llm_trace | raw_llm_trace | jsonb | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_ai_interpretation_tenant` (tenant_id) [btree]
> INDEX `idx_ai_interpretation_run` (run_id) [btree]

