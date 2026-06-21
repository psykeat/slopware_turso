# Table: `currency`

> _⚠ pending annotation_

| Column      | Business Name | Type                     | Class | Constraints                | Description |
| :---------- | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| currency_id | currency_id   | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| code        | code          | varchar(3)               | —     | NOT NULL                   |             |
| name        | name          | jsonb                    | —     | NOT NULL                   |             |
| symbol      | symbol        | varchar(5)               | —     |                            |             |
| decimals    | decimals      | integer                  | —     | NOT NULL, DEFAULT 2        |             |
| archived    | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at  | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `currency_code_key` (code) [btree]
