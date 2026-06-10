# Table: `ai_plan`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| plan_id | plan_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| run_id | run_id | uuid | — | NOT NULL |  |
| prompt_version_id | prompt_version_id | uuid | — | NOT NULL |  |
| plan_json | plan_json | jsonb | — | NOT NULL |  |
| confidence_score | confidence_score | numeric | — | NOT NULL |  |
| apply_readiness | apply_readiness | text | — | NOT NULL |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_ai_plan_tenant` (tenant_id) [btree]
> INDEX `idx_ai_plan_run` (run_id) [btree]
> INDEX `idx_ai_plan_prompt_version` (prompt_version_id) [btree]
> INDEX `idx_ai_plan_readiness` (apply_readiness) [btree]

