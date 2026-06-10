# Table: `ai_context_projection`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| projection_id | projection_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| session_id | session_id | uuid | — | NOT NULL |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| focus_type | focus_type | text | — | NOT NULL |  |
| focus_id | focus_id | text | — | NOT NULL |  |
| snapshot | snapshot | jsonb | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL |  |

> INDEX `idx_ai_context_projection_session` (session_id) [btree]

