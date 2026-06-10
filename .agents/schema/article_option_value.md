# Table: `article_option_value`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| value_id | value_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| option_id | option_id | uuid | — | NOT NULL |  |
| value | value | text | — | NOT NULL |  |
| sort_order | sort_order | integer | — | NOT NULL |  |

> INDEX `idx_article_optval_tenant` (tenant_id) [btree]
> INDEX `idx_article_optval_option` (option_id) [btree]

