# Table: `email_thread`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| email_thread_id     | email_thread_id     | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                   |             |
| email_account_id    | email_account_id    | uuid                     | —     | NOT NULL                   |             |
| provider_thread_id  | provider_thread_id  | text                     | —     | NOT NULL                   |             |
| subject             | subject             | text                     | —     |                            |             |
| snippet             | snippet             | text                     | —     |                            |             |
| last_message_at     | last_message_at     | timestamp with time zone | —     |                            |             |
| is_read             | is_read             | boolean                  | —     | NOT NULL                   |             |
| is_starred          | is_starred          | boolean                  | —     | NOT NULL                   |             |
| message_count       | message_count       | integer                  | —     | NOT NULL                   |             |
| related_address_id  | related_address_id  | uuid                     | —     |                            |             |
| related_document_id | related_document_id | uuid                     | —     |                            |             |
| archived            | archived            | boolean                  | —     | NOT NULL                   |             |
| in_trash            | in_trash            | boolean                  | —     | NOT NULL                   |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at          | updated_at          | timestamp with time zone | —     |                            |             |

> INDEX `idx_email_thread_mailbox_list` (tenant_id, email_account_id, archived, last_message_at, created_at) [btree]
> INDEX `idx_email_thread_document` (tenant_id, related_document_id) [btree]
> INDEX `idx_email_thread_address` (tenant_id, related_address_id) [btree]
