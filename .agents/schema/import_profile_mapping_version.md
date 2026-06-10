# Table: `import_profile_mapping_version`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| version_id | version_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| tenant_connector_id | tenant_connector_id | uuid | — | NOT NULL |  |
| profile_id | profile_id | uuid | — | NOT NULL |  |
| version_no | version_no | integer | — | NOT NULL, DEFAULT 1 |  |
| mappings | mappings | jsonb | — | NOT NULL |  |
| is_active | is_active | boolean | — | NOT NULL |  |
| activated_at | activated_at | timestamp with time zone | — |  |  |
| activated_by | activated_by | text | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_import_mapping_version_lookup` (tenant_connector_id, profile_id, is_active) [btree]

