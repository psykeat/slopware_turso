# Table: `capability_execution_log`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| capability_execution_log_id | capability_execution_log_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| idempotency_key | idempotency_key | text | — | NOT NULL |  |
| capability_key | capability_key | text | — | NOT NULL |  |
| input_hash | input_hash | char(64) | — | NOT NULL |  |
| status | status | text | — | NOT NULL |  |
| result | result | jsonb | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| completed_at | completed_at | timestamp with time zone | — |  |  |

> INDEX `uq_capability_execution_log_key` (tenant_id, idempotency_key) [btree]
> INDEX `idx_capability_execution_log_tenant` (tenant_id) [btree]

