# Table: `ai_apply_attempt`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| attempt_id | attempt_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| plan_id | plan_id | uuid | — | NOT NULL |  |
| applied_plan_json | applied_plan_json | jsonb | — | NOT NULL |  |
| status | status | text | — | NOT NULL |  |
| executed_by_user_id | executed_by_user_id | text | — | NOT NULL |  |
| error_logs | error_logs | text | — |  |  |
| applied_at | applied_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_ai_apply_attempt_tenant` (tenant_id) [btree]
> INDEX `idx_ai_apply_attempt_plan` (plan_id) [btree]
> INDEX `idx_ai_apply_attempt_executor` (executed_by_user_id) [btree]
> INDEX `idx_ai_apply_attempt_status` (status) [btree]

