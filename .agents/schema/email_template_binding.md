# Table: `email_template_binding`

> _⚠ pending annotation_

| Column                    | Business Name             | Type                     | Class | Constraints                | Description |
| :------------------------ | :------------------------ | :----------------------- | :---- | :------------------------- | :---------- |
| email_template_binding_id | email_template_binding_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                 | tenant_id                 | uuid                     | —     | NOT NULL                   |             |
| email_template_id         | email_template_id         | uuid                     | —     | NOT NULL                   |             |
| document_type             | document_type             | char(1)                  | —     |                            |             |
| company_id                | company_id                | uuid                     | —     |                            |             |
| language                  | language                  | char(2)                  | —     |                            |             |
| email_identity_id         | email_identity_id         | uuid                     | —     |                            |             |
| priority                  | priority                  | integer                  | —     | NOT NULL, DEFAULT 100      |             |
| archived                  | archived                  | boolean                  | —     | NOT NULL                   |             |
| created_at                | created_at                | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_template_binding_lookup` (tenant_id, document_type, company_id, language, email_identity_id) [btree]
