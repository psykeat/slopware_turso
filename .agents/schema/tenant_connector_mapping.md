# Table: `tenant_connector_mapping`

> _⚠ pending annotation_

| Column              | Business Name       | Type  | Class | Constraints                       | Description |
| :------------------ | :------------------ | :---- | :---- | :-------------------------------- | :---------- |
| mapping_id          | mapping_id          | uuid  | PK    | NOT NULL, DEFAULT uuidv7()        |             |
| tenant_id           | tenant_id           | uuid  | —     | NOT NULL                          |             |
| tenant_connector_id | tenant_connector_id | uuid  | —     | NOT NULL                          |             |
| profile_id          | profile_id          | uuid  | —     | NOT NULL                          |             |
| source_field        | source_field        | text  | —     | NOT NULL                          |             |
| target_table        | target_table        | text  | —     | NOT NULL                          |             |
| target_column       | target_column       | text  | —     | NOT NULL                          |             |
| transform           | transform           | jsonb | —     | NOT NULL, DEFAULT [object Object] |             |
| default_value       | default_value       | jsonb | —     |                                   |             |
