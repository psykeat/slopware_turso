# Table: `document_type`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| document_type_id | document_type_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| code | code | varchar(20) | — | NOT NULL |  |
| name | name | varchar(100) | — | NOT NULL |  |
| movement_type | movement_type | char(1) | — | NOT NULL |  |
| next_document_type_id | next_document_type_id | uuid | — |  |  |
| requires_warehouse | requires_warehouse | boolean | — | NOT NULL, DEFAULT true |  |
| requires_cost_center | requires_cost_center | boolean | — | NOT NULL |  |
| archived | archived | boolean | — | NOT NULL |  |
| sort_order | sort_order | integer | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_document_type_tenant` (tenant_id) [btree]

> CHECK `document_type_movement_type_check`: [object Object]

