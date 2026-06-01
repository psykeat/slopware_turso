# Table: `email_outbox`

> _⚠ pending annotation_

| Column            | Business Name     | Type                     | Class | Constraints                       | Description |
| :---------------- | :---------------- | :----------------------- | :---- | :-------------------------------- | :---------- |
| email_outbox_id   | email_outbox_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id         | tenant_id         | uuid                     | —     | NOT NULL                          |             |
| email_account_id  | email_account_id  | uuid                     | —     | NOT NULL                          |             |
| email_identity_id | email_identity_id | uuid                     | —     | NOT NULL                          |             |
| email_message_id  | email_message_id  | uuid                     | —     |                                   |             |
| provider_draft_id | provider_draft_id | text                     | —     |                                   |             |
| status            | status            | text                     | —     | NOT NULL, DEFAULT draft           |             |
| payload           | payload           | jsonb                    | —     | NOT NULL, DEFAULT [object Object] |             |
| scheduled_for     | scheduled_for     | timestamp with time zone | —     |                                   |             |
| sent_at           | sent_at           | timestamp with time zone | —     |                                   |             |
| last_error        | last_error        | text                     | —     |                                   |             |
| created_at        | created_at        | timestamp with time zone | —     | NOT NULL, DEFAULT now()           |             |
| updated_at        | updated_at        | timestamp with time zone | —     |                                   |             |
| created_by        | created_by        | text                     | —     |                                   |             |

> INDEX `idx_email_outbox_queue` (tenant_id, email_account_id, status, updated_at, created_at) [btree]
> INDEX `idx_email_outbox_message` (tenant_id, email_message_id) [btree]

> CHECK `chk_email_outbox_status`: [object Object]
