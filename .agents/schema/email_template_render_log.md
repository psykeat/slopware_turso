# Table: `email_template_render_log`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| email_template_render_log_id | email_template_render_log_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| email_template_id | email_template_id | uuid | — |  |  |
| email_template_binding_id | email_template_binding_id | uuid | — |  |  |
| document_id | document_id | uuid | — |  |  |
| email_identity_id | email_identity_id | uuid | — |  |  |
| language | language | char(2) | — |  |  |
| subject | subject | text | — | NOT NULL |  |
| rendered_hash | rendered_hash | text | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| created_by | created_by | text | — |  |  |

> INDEX `idx_email_template_render_log_document` (tenant_id, document_id) [btree]
> INDEX `idx_email_template_render_log_template` (tenant_id, email_template_id) [btree]

