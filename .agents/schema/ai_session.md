# Table: `ai_session`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints                | Description |
| :--------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| session_id | session_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id  | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| user_id    | user_id       | text                     | —     | NOT NULL                   |             |
| mode       | mode          | text                     | —     | NOT NULL, DEFAULT 'sync'   |             |
| focus_type | focus_type    | text                     | —     | NOT NULL                   |             |
| focus_id   | focus_id      | text                     | —     | NOT NULL                   |             |
| status     | status        | ai_session_status        | —     | NOT NULL, DEFAULT active   |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_ai_session_tenant` (tenant_id) [btree]
> INDEX `idx_ai_session_user` (user_id) [btree]
> INDEX `idx_ai_session_status` (status) [btree]
> INDEX `idx_ai_session_focus` (focus_type, focus_id) [btree]
