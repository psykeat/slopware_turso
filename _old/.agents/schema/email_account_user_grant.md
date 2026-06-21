# Table: `email_account_user_grant`

> _⚠ pending annotation_

| Column                      | Business Name               | Type                     | Class | Constraints                | Description |
| :-------------------------- | :-------------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_account_user_grant_id | email_account_user_grant_id | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                   | tenant_id                   | uuid                     | —     | NOT NULL                   |             |
| email_account_id            | email_account_id            | uuid                     | —     | NOT NULL                   |             |
| user_id                     | user_id                     | text                     | —     | NOT NULL                   |             |
| can_read                    | can_read                    | boolean                  | —     | NOT NULL, DEFAULT true     |             |
| can_send                    | can_send                    | boolean                  | —     | NOT NULL                   |             |
| can_manage                  | can_manage                  | boolean                  | —     | NOT NULL                   |             |
| created_at                  | created_at                  | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |

> INDEX `idx_email_account_grant_user` (tenant_id, user_id) [btree]
