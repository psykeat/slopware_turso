# Table: `ai_review`

> _⚠ pending annotation_

| Column                      | Business Name               | Type                     | Class | Constraints                | Description |
| :-------------------------- | :-------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| review_id                   | review_id                   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                   | tenant_id                   | uuid                     | —     | NOT NULL                   |             |
| interpretation_id           | interpretation_id           | uuid                     | —     | NOT NULL                   |             |
| run_id                      | run_id                      | uuid                     | —     | NOT NULL                   |             |
| review_status               | review_status               | text                     | —     | NOT NULL                   |             |
| business_case               | business_case               | text                     | —     | NOT NULL                   |             |
| headline                    | headline                    | text                     | —     | NOT NULL                   |             |
| summary                     | summary                     | text                     | —     | NOT NULL                   |             |
| intent_badge_json           | intent_badge_json           | jsonb                    | —     | NOT NULL                   |             |
| sections_json               | sections_json               | jsonb                    | —     | NOT NULL                   |             |
| warnings_json               | warnings_json               | jsonb                    | —     | NOT NULL                   |             |
| blocking_issues_json        | blocking_issues_json        | jsonb                    | —     | NOT NULL                   |             |
| proposed_apply_payload_json | proposed_apply_payload_json | jsonb                    | —     | NOT NULL                   |             |
| applied_overrides_json      | applied_overrides_json      | jsonb                    | —     |                            |             |
| created_at                  | created_at                  | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at                  | updated_at                  | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_review_tenant` (tenant_id) [btree]
> INDEX `idx_ai_review_interpretation` (interpretation_id) [btree]
