# Table: `ai_tool_review`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints                | Description |
| :--------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| review_id  | review_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| session_id | session_id    | uuid                     | —     | NOT NULL                   |             |
| tenant_id  | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| tool_name  | tool_name     | text                     | —     | NOT NULL                   |             |
| proposal   | proposal      | jsonb                    | —     | NOT NULL                   |             |
| status     | status        | ai_tool_review_status    | —     | NOT NULL, DEFAULT pending  |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL                   |             |
| applied_at | applied_at    | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_tool_review_session` (session_id) [btree]
> INDEX `idx_ai_tool_review_tenant` (tenant_id) [btree]
