# Table: `postal_code`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| postal_code_id | postal_code_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| country_code | country_code | varchar(2) | — | NOT NULL |  |
| plz | plz | text | — | NOT NULL |  |
| city | city | text | — | NOT NULL |  |
| state | state | text | — |  |  |
| archived | archived | boolean | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_postal_code_lookup` (country_code, plz) [btree]

