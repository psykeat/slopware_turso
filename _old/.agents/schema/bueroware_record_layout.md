# Table: `bueroware_record_layout`

> _⚠ pending annotation_

| Column                | Business Name         | Type                     | Class | Constraints                | Description |
| :-------------------- | :-------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| layout_id             | layout_id             | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| file_name             | file_name             | text                     | —     | NOT NULL                   |             |
| data_area             | data_area             | text                     | —     | NOT NULL                   |             |
| qualifier             | qualifier             | text                     | —     |                            |             |
| default_target_entity | default_target_entity | text                     | —     |                            |             |
| catalog_version       | catalog_version       | integer                  | —     | NOT NULL, DEFAULT 1        |             |
| is_active             | is_active             | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| field_count           | field_count           | integer                  | —     | NOT NULL                   |             |
| created_at            | created_at            | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_bueroware_layout_file_active` (file_name, is_active) [btree]
