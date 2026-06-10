# Table: `email_identity`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| email_identity_id | email_identity_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| email_account_id | email_account_id | uuid | — | NOT NULL |  |
| email | email | text | — | NOT NULL |  |
| display_name | display_name | text | — |  |  |
| provider_identity_id | provider_identity_id | text | — |  |  |
| is_primary | is_primary | boolean | — | NOT NULL |  |
| can_send | can_send | boolean | — | NOT NULL, DEFAULT true |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_email_identity_account` (tenant_id, email_account_id) [btree]

