# Table: `email_message`

> _⚠ pending annotation_

| Column              | Business Name       | Type                     | Class | Constraints                       | Description |
| :------------------ | :------------------ | :----------------------- | :---- | :-------------------------------- | :---------- |
| email_message_id    | email_message_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id           | tenant_id           | uuid                     | —     | NOT NULL                          |             |
| email_account_id    | email_account_id    | uuid                     | —     | NOT NULL                          |             |
| email_thread_id     | email_thread_id     | uuid                     | —     | NOT NULL                          |             |
| provider_message_id | provider_message_id | text                     | —     | NOT NULL                          |             |
| provider_draft_id   | provider_draft_id   | text                     | —     |                                   |             |
| internet_message_id | internet_message_id | text                     | —     |                                   |             |
| direction           | direction           | text                     | —     | NOT NULL                          |             |
| from_json           | from_json           | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| to_json             | to_json             | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| cc_json             | cc_json             | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| bcc_json            | bcc_json            | jsonb                    | —     | NOT NULL, DEFAULT                 |             |
| subject             | subject             | text                     | —     |                                   |             |
| snippet             | snippet             | text                     | —     |                                   |             |
| body_html           | body_html           | text                     | —     |                                   |             |
| body_text           | body_text           | text                     | —     |                                   |             |
| sent_at             | sent_at             | timestamp with time zone | —     |                                   |             |
| received_at         | received_at         | timestamp with time zone | —     |                                   |             |
| is_read             | is_read             | boolean                  | —     | NOT NULL                          |             |
| has_attachments     | has_attachments     | boolean                  | —     | NOT NULL                          |             |
| raw_headers         | raw_headers         | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| created_at          | created_at          | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| updated_at          | updated_at          | timestamp with time zone | —     |                                   |             |

> INDEX `idx_email_message_thread` (tenant_id, email_thread_id) [btree]
> INDEX `idx_email_message_thread_timeline` (tenant_id, email_thread_id, received_at, sent_at, created_at) [btree]
> INDEX `idx_email_message_account_date` (tenant_id, email_account_id, received_at) [btree]

> CHECK `chk_email_message_direction`: [object Object]
