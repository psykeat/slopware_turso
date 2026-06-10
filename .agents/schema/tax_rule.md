# Table: `tax_rule`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| tax_rule_id | tax_rule_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| customer_tax_class_id | customer_tax_class_id | uuid | — |  |  |
| article_tax_class_id | article_tax_class_id | uuid | — |  |  |
| country_code | country_code | char(2) | — |  |  |
| tax_code_id | tax_code_id | uuid | — | NOT NULL |  |
| valid_from | valid_from | date | — | NOT NULL |  |
| valid_to | valid_to | date | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_tax_rule_lookup` (tenant_id, customer_tax_class_id, article_tax_class_id, country_code, valid_from) [btree]
> INDEX `idx_tax_rule_tenant` (tenant_id) [btree]

