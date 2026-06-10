# Table: `industry`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| industry_id | industry_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| name | name | jsonb | — | NOT NULL |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| custom_attributes | custom_attributes | jsonb | — |  |  |

> INDEX `idx_industry_tenant` (tenant_id) [btree]

