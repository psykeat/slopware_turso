# Table: `article_bom`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| bom_id | bom_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| header_article_id | header_article_id | uuid | — | NOT NULL |  |
| component_article_id | component_article_id | uuid | — | NOT NULL |  |
| quantity | quantity | numeric | — | NOT NULL |  |
| scrap_percentage | scrap_percentage | numeric | — | NOT NULL, DEFAULT 0 |  |
| sort_order | sort_order | integer | — | NOT NULL |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> CHECK `article_bom_quantity_check`: [object Object]

