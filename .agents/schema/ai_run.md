# Table: `ai_run`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| run_id | run_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| user_id | user_id | text | — | NOT NULL |  |
| task_scope | task_scope | text | — | NOT NULL |  |
| status | status | text | — | NOT NULL |  |
| duration_ms | duration_ms | integer | — |  |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_ai_run_tenant` (tenant_id) [btree]
> INDEX `idx_ai_run_user` (user_id) [btree]
> INDEX `idx_ai_run_status` (status) [btree]

