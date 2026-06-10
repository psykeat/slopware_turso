# Table: `document_shipment_package`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| document_shipment_package_id | document_shipment_package_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| document_shipment_id | document_shipment_id | uuid | — | NOT NULL |  |
| seq | seq | integer | — | NOT NULL, DEFAULT 1 |  |
| weight_kg | weight_kg | numeric | — | NOT NULL, DEFAULT 1.0 |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_shipment_package_shipment` (document_shipment_id) [btree]

