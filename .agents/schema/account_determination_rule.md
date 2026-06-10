# Table: `account_determination_rule`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| rule_id | rule_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| company_id | company_id | uuid | — |  |  |
| article_group_id | article_group_id | uuid | — |  |  |
| tax_code_id | tax_code_id | uuid | — |  |  |
| posting_context | posting_context | text | — | NOT NULL |  |
| gl_account_id | gl_account_id | uuid | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_acct_det_lookup` (tenant_id, posting_context, article_group_id, tax_code_id) [btree]
> INDEX `idx_acct_det_tenant` (tenant_id) [btree]

