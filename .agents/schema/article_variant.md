# Table: `article_variant`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| variant_id | variant_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| article_id | article_id | uuid | — | NOT NULL |  |
| sku | sku | text | — | NOT NULL |  |
| ean | ean | text | — |  |  |
| option_value_hash | option_value_hash | text | — | NOT NULL |  |
| price | price | numeric | — |  |  |
| weight | weight | numeric | — |  |  |
| is_active | is_active | boolean | — | NOT NULL, DEFAULT true |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_article_variant_tenant` (tenant_id) [btree]
> INDEX `idx_article_variant_article` (article_id) [btree]

