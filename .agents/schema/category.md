# Table: `category`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| category_id | category_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| parent_category_id | parent_category_id | uuid | — |  |  |
| code | code | text | — |  |  |
| name | name | text | — | NOT NULL |  |
| slug | slug | text | — |  |  |
| description | description | text | — |  |  |
| sort_order | sort_order | integer | — | NOT NULL |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_category_tenant` (tenant_id) [btree]
> INDEX `idx_category_parent` (tenant_id, parent_category_id) [btree]
> INDEX `idx_category_tenant_archived` (tenant_id, archived) [btree]

