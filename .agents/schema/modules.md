# Table: `modules`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| module_id | module_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| slug | slug | text | — | NOT NULL |  |
| label | label | jsonb | — | NOT NULL |  |

> INDEX `modules_slug_key` (slug) [btree]

