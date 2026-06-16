# Table: `bueroware_record_field`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| field_id | field_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| layout_id | layout_id | uuid | — | NOT NULL |  |
| bueroware_field_id | bueroware_field_id | text | — | NOT NULL |  |
| label | label | text | — |  |  |
| sample_value | sample_value | text | — |  |  |
| position | position | integer | — |  |  |
| length | length | integer | — |  |  |
| formatting | formatting | text | — |  |  |
| refresh_table | refresh_table | text | — |  |  |
| import_marker | import_marker | text | — |  |  |
| ordinal | ordinal | integer | — |  |  |
| default_target_field | default_target_field | text | — |  |  |
| default_reference_entity | default_reference_entity | text | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_bueroware_field_layout` (layout_id) [btree]

