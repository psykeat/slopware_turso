# Table: `price_list`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| price_list_id | price_list_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| name | name | text | — | NOT NULL |  |
| currency_id | currency_id | char(3) | — | NOT NULL |  |
| is_net | is_net | boolean | — | NOT NULL, DEFAULT true |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_price_list_tenant` (tenant_id) [btree]

