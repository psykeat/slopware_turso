# Table: `incoterm`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| incoterm_id | incoterm_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| code | code | char(3) | — | NOT NULL |  |
| name | name | text | — | NOT NULL |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `incoterm_code_key` (code) [btree]

