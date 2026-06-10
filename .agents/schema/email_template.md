# Table: `email_template`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| email_template_id | email_template_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| category | category | text | — | NOT NULL, DEFAULT document |  |
| code | code | text | — | NOT NULL |  |
| name | name | text | — | NOT NULL |  |
| subject_template | subject_template | text | — | NOT NULL |  |
| body_html_template | body_html_template | text | — | NOT NULL |  |
| body_text_template | body_text_template | text | — |  |  |
| language | language | char(2) | — |  |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_email_template_tenant` (tenant_id, category) [btree]

