# Table: `ai_evidence`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| evidence_id      | evidence_id      | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| plan_id          | plan_id          | uuid                     | —     | NOT NULL                   |             |
| field_name       | field_name       | text                     | —     | NOT NULL                   |             |
| source_text      | source_text      | text                     | —     | NOT NULL                   |             |
| match_confidence | match_confidence | numeric                  | —     | NOT NULL                   |             |
| ambiguity_note   | ambiguity_note   | text                     | —     |                            |             |
| archived         | archived         | boolean                  | —     | NOT NULL                   |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at       | updated_at       | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_evidence_tenant` (tenant_id) [btree]
> INDEX `idx_ai_evidence_plan` (plan_id) [btree]
> INDEX `idx_ai_evidence_field` (field_name) [btree]
