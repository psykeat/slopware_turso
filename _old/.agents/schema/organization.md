# Table: `organization`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints                | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :------------------------- | :---------- |
| organization_id | organization_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| slug            | slug            | varchar(63)              | —     | NOT NULL                   |             |
| name            | name            | text                     | —     | NOT NULL                   |             |
| is_active       | is_active       | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| archived        | archived        | boolean                  | —     | NOT NULL                   |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `organization_slug_key` (slug) [btree]
