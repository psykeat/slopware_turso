# Table: `article_media`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| article_media_id | article_media_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| article_id | article_id | uuid | — | NOT NULL |  |
| variant_id | variant_id | uuid | — |  |  |
| media_asset_id | media_asset_id | uuid | — | NOT NULL |  |
| role | role | text | — | NOT NULL, DEFAULT gallery |  |
| sort_order | sort_order | integer | — | NOT NULL |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_article_media_tenant_article` (tenant_id, article_id) [btree]
> INDEX `idx_article_media_tenant_variant` (tenant_id, variant_id) [btree]
> INDEX `idx_article_media_tenant_asset` (tenant_id, media_asset_id) [btree]

