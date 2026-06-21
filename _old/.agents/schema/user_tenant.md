# Table: `user_tenant`

> _⚠ pending annotation_

| Column    | Business Name | Type | Class | Constraints                | Description |
| :-------- | :------------ | :--- | :---- | :------------------------- | :---------- |
| id        | id            | uuid | PK    | NOT NULL, DEFAULT uuidv7() |             |
| user_id   | user_id       | text | —     | NOT NULL                   |             |
| tenant_id | tenant_id     | uuid | —     | NOT NULL                   |             |
| role      | role          | text | —     | NOT NULL                   |             |

> INDEX `idx_user_tenant_tenant` (tenant_id) [btree]
> INDEX `idx_user_tenant_user` (user_id) [btree]
