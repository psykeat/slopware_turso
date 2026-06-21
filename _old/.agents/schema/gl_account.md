# Table: `gl_account`

> _⚠ pending annotation_

| Column        | Business Name | Type                     | Class | Constraints                | Description |
| :------------ | :------------ | :----------------------- | :---- | :------------------------- | :---------- |
| gl_account_id | gl_account_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id     | tenant_id     | uuid                     | —     | NOT NULL                   |             |
| company_id    | company_id    | uuid                     | —     |                            |             |
| account_no    | account_no    | text                     | —     | NOT NULL                   |             |
| name          | name          | text                     | —     | NOT NULL                   |             |
| account_type  | account_type  | text                     | —     | NOT NULL                   |             |
| archived      | archived      | boolean                  | —     | NOT NULL                   |             |
| created_at    | created_at    | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_gl_account_tenant` (tenant_id) [btree]
