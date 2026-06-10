# Table: `document_group`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| document_group_id | document_group_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| name | name | text | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| number_sequence_id | number_sequence_id | uuid | — |  |  |
| description | description | text | — |  |  |
| default_warehouse_id | default_warehouse_id | uuid | — |  |  |
| default_tax_code_id | default_tax_code_id | uuid | — |  |  |
| default_sales_account_id | default_sales_account_id | uuid | — |  |  |
| default_cost_account_id | default_cost_account_id | uuid | — |  |  |
| archived | archived | boolean | — | NOT NULL |  |
| sort_order | sort_order | integer | — |  |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |
| default_payment_term_id | default_payment_term_id | uuid | — |  |  |
| default_shipping_method_id | default_shipping_method_id | uuid | — |  |  |
| require_serial_tracking | require_serial_tracking | boolean | — | NOT NULL, DEFAULT true |  |
| require_batch_tracking | require_batch_tracking | boolean | — | NOT NULL, DEFAULT true |  |
| document_type | document_type | varchar(1) | — | NOT NULL |  |
| group_number | group_number | integer | — | NOT NULL |  |
| direction | direction | varchar(20) | — |  |  |
| next_group_id | next_group_id | uuid | — |  |  |
| company_id | company_id | uuid | — |  |  |

> INDEX `idx_document_group_company` (company_id) [btree]
> INDEX `idx_document_group_tenant` (tenant_id) [btree]

> CHECK `document_group_group_number_check`: [object Object]

