# Table: `email_label`

> _⚠ pending annotation_

| Column                   | Business Name            | Type                     | Class | Constraints                | Description |
| :----------------------- | :----------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_label_id           | email_label_id           | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                | tenant_id                | uuid                     | —     | NOT NULL                   |             |
| email_account_id         | email_account_id         | uuid                     | —     | NOT NULL                   |             |
| provider_label_id        | provider_label_id        | text                     | —     | NOT NULL                   |             |
| name                     | name                     | text                     | —     | NOT NULL                   |             |
| kind                     | kind                     | text                     | —     | NOT NULL, DEFAULT label    |             |
| color                    | color                    | text                     | —     |                            |             |
| parent_provider_label_id | parent_provider_label_id | text                     | —     |                            |             |
| message_count            | message_count            | integer                  | —     | NOT NULL                   |             |
| unread_count             | unread_count             | integer                  | —     | NOT NULL                   |             |
| archived                 | archived                 | boolean                  | —     | NOT NULL                   |             |
| created_at               | created_at               | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at               | updated_at               | timestamp with time zone | —     |                            |             |

> INDEX `idx_email_label_account_active` (tenant_id, email_account_id, archived, kind, name) [btree]

> CHECK `chk_email_label_kind`: [object Object]
