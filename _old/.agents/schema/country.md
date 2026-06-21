# Table: `country`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints                | Description |
| :--------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| country_id | country_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| iso2_code  | iso2_code     | varchar(2)               | —     | NOT NULL                   |             |
| iso3_code  | iso3_code     | varchar(3)               | —     | NOT NULL                   |             |
| name       | name          | jsonb                    | —     | NOT NULL                   |             |
| is_eu      | is_eu         | boolean                  | —     | NOT NULL                   |             |
| archived   | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `country_iso2_code_key` (iso2_code) [btree]
> INDEX `country_iso3_code_key` (iso3_code) [btree]
