# Table: `email_template`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| email_template_id | ID | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | Tenant | uuid | — | NOT NULL |  |
| category | Category | text | — | NOT NULL, DEFAULT document | Bucket: `document` = document send; future: `reminder`, `marketing`. |
| code | Code | text | — | NOT NULL | Stable machine key, unique per (tenant, category). Used as a stable seed reference, e.g. `document-N`. |
| name | Name | text | — | NOT NULL | Human-readable label shown in the UI dropdown, e.g. "Angebot". |
| subject_template | Subject | text | — | NOT NULL | `{{placeholder}}` string rendered into the email subject. |
| body_html_template | Body (HTML) | text | — | NOT NULL | `{{placeholder}}` HTML rendered into the email body. |
| body_text_template | Body (plain) | text | — |  | Optional plain-text fallback; auto-derived from HTML if omitted. |
| language | Language | char(2) | — |  | Optional 2-letter ISO code, e.g. `de`. Matched by binding resolution when a language is passed. |
| archived | Archived | boolean | — | NOT NULL | Soft-delete flag; archived templates are never resolved. |
| created_at | Created | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | Updated | timestamp with time zone | — |  | Set on PATCH. |

> INDEX `idx_email_template_tenant` (tenant_id, category) [btree]

