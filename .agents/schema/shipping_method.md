# Table: `shipping_method`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| shipping_method_id | shipping_method_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| name | name | jsonb | — | NOT NULL |  |
| tracking_url_template | tracking_url_template | text | — |  |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| custom_attributes | custom_attributes | jsonb | — |  |  |

> INDEX `idx_shipping_method_tenant` (tenant_id) [btree]

