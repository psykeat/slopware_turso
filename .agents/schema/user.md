# Table: `user`

> _⚠ pending annotation_

| Column          | Business Name   | Type                     | Class | Constraints             | Description |
| :-------------- | :-------------- | :----------------------- | :---- | :---------------------- | :---------- |
| id              | id              | text                     | PK    | NOT NULL                |             |
| name            | name            | text                     | —     | NOT NULL                |             |
| email           | email           | text                     | —     | NOT NULL                |             |
| email_verified  | email_verified  | boolean                  | —     | NOT NULL                |             |
| image           | image           | text                     | —     |                         |             |
| created_at      | created_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| updated_at      | updated_at      | timestamp with time zone | —     | NOT NULL, DEFAULT now() |             |
| display_name    | display_name    | text                     | —     |                         |             |
| is_active       | is_active       | boolean                  | —     | NOT NULL, DEFAULT true  |             |
| last_company_id | last_company_id | text                     | —     |                         |             |
| is_system_admin | is_system_admin | boolean                  | —     | NOT NULL                |             |
| locale          | locale          | varchar(5)               | —     | NOT NULL, DEFAULT de    |             |
