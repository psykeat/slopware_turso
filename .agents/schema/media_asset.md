# Table: `media_asset`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| media_asset_id | media_asset_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| storage_key | storage_key | text | — | NOT NULL |  |
| file_name | file_name | text | — | NOT NULL |  |
| mime_type | mime_type | text | — | NOT NULL |  |
| file_size | file_size | integer | — |  |  |
| width | width | integer | — |  |  |
| height | height | integer | — |  |  |
| alt_text | alt_text | text | — |  |  |
| checksum | checksum | text | — |  |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_media_asset_tenant` (tenant_id) [btree]
> INDEX `idx_media_asset_tenant_archived` (tenant_id, archived) [btree]

