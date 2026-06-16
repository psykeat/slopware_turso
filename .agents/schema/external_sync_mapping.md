# Table: `external_sync_mapping`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| mapping_id | mapping_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| sales_channel_id | sales_channel_id | uuid | — |  |  |
| source_system | source_system | text | — | NOT NULL, DEFAULT sales_channel |  |
| entity_type | entity_type | external_sync_entity_type | — | NOT NULL |  |
| internal_id | internal_id | uuid | — | NOT NULL |  |
| external_id | external_id | text | — | NOT NULL |  |
| external_parent_id | external_parent_id | text | — |  |  |
| external_version | external_version | text | — |  |  |
| sync_direction | sync_direction | external_sync_direction | — | NOT NULL |  |
| payload_snapshot | payload_snapshot | jsonb | — |  |  |
| last_sync_at | last_sync_at | timestamp with time zone | — |  |  |
| sync_status | sync_status | external_sync_status | — | NOT NULL, DEFAULT pending |  |
| error_log | error_log | text | — |  |  |
| deleted_at | deleted_at | timestamp with time zone | — |  |  |
| external_deleted_at | external_deleted_at | timestamp with time zone | — |  |  |

> INDEX `idx_ext_sync_tenant` (tenant_id) [btree]
> INDEX `idx_ext_sync_tenant_lookup` (tenant_id, source_system, entity_type) [btree]

