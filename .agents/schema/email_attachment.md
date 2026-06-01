# Table: `email_attachment`

> _⚠ pending annotation_

| Column                 | Business Name          | Type                     | Class | Constraints                | Description |
| :--------------------- | :--------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_attachment_id    | email_attachment_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id              | tenant_id              | uuid                     | —     | NOT NULL                   |             |
| email_message_id       | email_message_id       | uuid                     | —     | NOT NULL                   |             |
| provider_attachment_id | provider_attachment_id | text                     | —     |                            |             |
| file_name              | file_name              | text                     | —     | NOT NULL                   |             |
| content_type           | content_type           | text                     | —     |                            |             |
| size_bytes             | size_bytes             | integer                  | —     |                            |             |
| storage_key            | storage_key            | text                     | —     |                            |             |
| inline_content_id      | inline_content_id      | text                     | —     |                            |             |
| fetched_at             | fetched_at             | timestamp with time zone | —     |                            |             |
| created_at             | created_at             | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_attachment_message` (tenant_id, email_message_id) [btree]
> INDEX `idx_email_attachment_storage` (tenant_id, storage_key) [btree]
