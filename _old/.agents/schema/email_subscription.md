# Table: `email_subscription`

> _⚠ pending annotation_

| Column                   | Business Name            | Type                     | Class | Constraints                | Description |
| :----------------------- | :----------------------- | :----------------------- | :---- | :------------------------- | :---------- |
| email_subscription_id    | email_subscription_id    | uuid                     | PK    | NOT NULL, DEFAULT uuidv7() |             |
| tenant_id                | tenant_id                | uuid                     | —     | NOT NULL                   |             |
| email_account_id         | email_account_id         | uuid                     | —     | NOT NULL                   |             |
| resource                 | resource                 | text                     | —     | NOT NULL, DEFAULT mail     |             |
| provider_subscription_id | provider_subscription_id | text                     | —     |                            |             |
| channel_token            | channel_token            | text                     | —     |                            |             |
| expires_at               | expires_at               | timestamp with time zone | —     |                            |             |
| renewed_at               | renewed_at               | timestamp with time zone | —     |                            |             |
| status                   | status                   | text                     | —     | NOT NULL, DEFAULT active   |             |
| renewal_attempts         | renewal_attempts         | integer                  | —     | NOT NULL                   |             |
| created_at               | created_at               | timestamp with time zone | —     | NOT NULL, DEFAULT now()    |             |
| updated_at               | updated_at               | timestamp with time zone | —     |                            |             |

> INDEX `idx_email_subscription_expires` (expires_at) [btree]
> INDEX `idx_email_subscription_account` (tenant_id, email_account_id) [btree]
> INDEX `idx_email_subscription_channel_token` (channel_token) [btree]

> CHECK `chk_email_subscription_resource`: [object Object]
> CHECK `chk_email_subscription_status`: [object Object]
