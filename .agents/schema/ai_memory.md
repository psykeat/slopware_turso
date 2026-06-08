# Table: `ai_memory`

> _⚠ pending annotation_

| Column           | Business Name    | Type                     | Class | Constraints                | Description |
| :--------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------- |
| memory_id        | memory_id        | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id        | tenant_id        | uuid                     | —     | NOT NULL                   |             |
| user_id          | user_id          | text                     | —     |                            |             |
| kind             | kind             | ai_memory_kind           | —     | NOT NULL                   |             |
| text             | text             | text                     | —     | NOT NULL                   |             |
| confidence       | confidence       | numeric                  | —     | NOT NULL                   |             |
| source_review_id | source_review_id | uuid                     | —     |                            |             |
| created_at       | created_at       | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| confirmed_at     | confirmed_at     | timestamp with time zone | —     |                            |             |

> INDEX `idx_ai_memory_tenant` (tenant_id) [btree]
> INDEX `idx_ai_memory_user` (user_id) [btree]
> INDEX `idx_ai_memory_kind` (kind) [btree]
> INDEX `idx_ai_memory_confirmed` (confirmed_at) [btree]
