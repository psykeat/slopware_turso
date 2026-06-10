# Table: `tax_code`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| tax_code_id | tax_code_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| code | code | text | — | NOT NULL |  |
| description | description | text | — |  |  |
| tax_rate | tax_rate | numeric | — | NOT NULL |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_tax_code_tenant` (tenant_id) [btree]

