# Table: `document_shipment`

> _⚠ pending annotation_

| Column               | Business Name        | Type                     | Class | Constraints                | Description |
| :------------------- | :------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| document_shipment_id | document_shipment_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id            | tenant_id            | uuid                     | —     | NOT NULL                   |             |
| document_id          | document_id          | uuid                     | —     | NOT NULL                   |             |
| shipment_status      | shipment_status      | text                     | —     | NOT NULL, DEFAULT open     |             |
| carrier_key          | carrier_key          | text                     | —     | NOT NULL, DEFAULT dhl      |             |
| carrier_service_key  | carrier_service_key  | text                     | —     | NOT NULL, DEFAULT paket    |             |
| tracking_id          | tracking_id          | text                     | —     |                            |             |
| recipient_name       | recipient_name       | text                     | —     | NOT NULL                   |             |
| company              | company              | text                     | —     |                            |             |
| street               | street               | text                     | —     | NOT NULL                   |             |
| house_number         | house_number         | text                     | —     | NOT NULL                   |             |
| postal_code          | postal_code          | text                     | —     | NOT NULL                   |             |
| city                 | city                 | text                     | —     | NOT NULL                   |             |
| country_code         | country_code         | char(2)                  | —     | NOT NULL, DEFAULT DE       |             |
| email                | email                | text                     | —     |                            |             |
| phone                | phone                | text                     | —     |                            |             |
| exported_at          | exported_at          | timestamp with time zone | —     |                            |             |
| label_created_at     | label_created_at     | timestamp with time zone | —     |                            |             |
| shipped_at           | shipped_at           | timestamp with time zone | —     |                            |             |
| created_at           | created_at           | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at           | updated_at           | timestamp with time zone | —     |                            |             |

> INDEX `idx_shipment_document` (document_id) [btree]
> INDEX `idx_shipment_status` (shipment_status) [btree]
