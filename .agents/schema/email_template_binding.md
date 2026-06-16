# Table: `email_template_binding`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| email_template_binding_id | ID | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | Tenant | uuid | — | NOT NULL |  |
| email_template_id | Template | uuid | — | NOT NULL | FK → `email_template`. |
| document_type | Belegart | char(1) | — |  | Scope to one document type: `N`=Angebot, `A`=Auftrag, `L`=Lieferschein, `R`=Rechnung, `G`=Gutschrift. `null` = any type. |
| company_id | Company | uuid | — |  | Scope to one sending company. `null` = any company. |
| language | Language | char(2) | — |  | Scope to a language, e.g. `de`. `null` = any language. |
| email_identity_id | Identity | uuid | — |  | Scope to a specific sending identity. `null` = any identity. |
| priority | Priority | integer | — | NOT NULL, DEFAULT 100 | Lower value = higher priority within same specificity score. |
| archived | Archived | boolean | — | NOT NULL | Soft-delete; archived bindings are excluded from resolution. |
| created_at | Created | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_email_template_binding_lookup` (tenant_id, document_type, company_id, language, email_identity_id) [btree]

