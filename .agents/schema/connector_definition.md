# Table: `connector_definition`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| connector_id | connector_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| slug | slug | text | — | NOT NULL |  |
| label | label | jsonb | — | NOT NULL |  |
| default_mappings | default_mappings | jsonb | — | NOT NULL, DEFAULT [object Object] |  |
| locked_fields | locked_fields | jsonb | — | NOT NULL, DEFAULT  |  |
| atomicity_mode | atomicity_mode | text | — | NOT NULL |  |

> INDEX `connector_definition_slug_key` (slug) [btree]

> CHECK `connector_definition_atomicity_mode_check`: [object Object]

