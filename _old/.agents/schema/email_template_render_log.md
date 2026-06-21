# Table: `email_template_render_log`

> _⚠ pending annotation_

| Column                       | Business Name    | Type                     | Class | Constraints                | Description                                                       |
| :--------------------------- | :--------------- | :----------------------- | :---- | :------------------------- | :---------------------------------------------------------------- |
| email_template_render_log_id | ID               | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |                                                                   |
| tenant_id                    | Tenant           | uuid                     | —     | NOT NULL                   |                                                                   |
| email_template_id            | Template         | uuid                     | —     |                            |                                                                   |
| email_template_binding_id    | Binding          | uuid                     | —     |                            |                                                                   |
| document_id                  | Document         | uuid                     | —     |                            |                                                                   |
| email_identity_id            | Identity         | uuid                     | —     |                            |                                                                   |
| language                     | Language         | char(2)                  | —     |                            | Language used for resolution.                                     |
| subject                      | Rendered subject | text                     | —     | NOT NULL                   | The final rendered subject line (after placeholder substitution). |
| rendered_hash                | Hash             | text                     | —     |                            | SHA of rendered content (reserved; not yet computed).             |
| created_at                   | Created          | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |                                                                   |
| created_by                   | Created by       | text                     | —     |                            |                                                                   |

> INDEX `idx_email_template_render_log_document` (tenant_id, document_id) [btree]
> INDEX `idx_email_template_render_log_template` (tenant_id, email_template_id) [btree]
