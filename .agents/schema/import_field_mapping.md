# Table: `import_field_mapping`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| mapping_id | mapping_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — |  |  |
| version_id | version_id | uuid | — | NOT NULL |  |
| position | position | integer | — |  |  |
| length | length | integer | — |  |  |
| qualifier | qualifier | text | — |  |  |
| formatting | formatting | text | — |  |  |
| source_field | source_field | text | — |  |  |
| target_field | target_field | text | — | NOT NULL |  |
| target_entity | target_entity | text | — |  |  |
| reference_entity | reference_entity | text | — |  |  |
| is_required | is_required | boolean | — | NOT NULL |  |
| default_value | default_value | text | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_field_mapping_version` (version_id) [btree]
> INDEX `idx_field_mapping_tenant` (tenant_id) [btree]

