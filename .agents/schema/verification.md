# Table: `verification`

> _⚠ pending annotation_

| Column     | Business Name | Type                     | Class | Constraints             | Description |
| :--------- | :------------ | :----------------------- | :---- | :---------------------- | :---------- |
| id         | id            | text                     | PK    | NOT NULL                |             |
| identifier | identifier    | text                     | —     | NOT NULL                |             |
| value      | value         | text                     | —     | NOT NULL                |             |
| expires_at | expires_at    | timestamp with time zone | —     | NOT NULL                |             |
| created_at | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at | updated_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |

> INDEX `verification_identifier_idx` (identifier) [btree]
