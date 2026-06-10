# Table: `address_seq`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| tenant_id | tenant_id | uuid | PK | NOT NULL |  |
| next_val | next_val | integer | — | NOT NULL, DEFAULT 1 |  |

> INDEX `idx_address_seq_tenant` (tenant_id) [btree]

