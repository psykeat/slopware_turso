# Table: `number_sequence`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| number_sequence_id | number_sequence_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| company_id | company_id | uuid | — | NOT NULL |  |
| prefix | prefix | varchar(10) | — | NOT NULL |  |
| fiscal_year | fiscal_year | integer | — |  |  |
| next_value | next_value | integer | — | NOT NULL, DEFAULT 1 |  |
| padding | padding | integer | — | NOT NULL, DEFAULT 5 |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_number_sequence_tenant` (tenant_id) [btree]
> INDEX `idx_number_sequence_tenant_company` (tenant_id, company_id) [btree]

