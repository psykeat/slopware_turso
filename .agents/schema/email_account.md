# Table: `email_account`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| email_account_id | email_account_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| provider | provider | text | — | NOT NULL |  |
| provider_account_id | provider_account_id | text | — | NOT NULL |  |
| display_name | display_name | text | — | NOT NULL |  |
| primary_email | primary_email | text | — | NOT NULL |  |
| status | status | text | — | NOT NULL, DEFAULT connected |  |
| credentials_encrypted | credentials_encrypted | text | — | NOT NULL |  |
| scopes | scopes | jsonb | — | NOT NULL, DEFAULT  |  |
| last_sync_at | last_sync_at | timestamp with time zone | — |  |  |
| last_sync_status | last_sync_status | text | — | NOT NULL, DEFAULT idle |  |
| last_sync_error | last_sync_error | text | — |  |  |
| watch_expires_at | watch_expires_at | timestamp with time zone | — |  |  |
| archived | archived | boolean | — | NOT NULL |  |
| granted_by_user_id | granted_by_user_id | text | — |  |  |
| granted_scopes | granted_scopes | jsonb | — |  |  |
| created_at | created_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |
| updated_at | updated_at | timestamp with time zone | — |  |  |

> INDEX `idx_email_account_tenant` (tenant_id) [btree]
> INDEX `idx_email_account_status` (tenant_id, status) [btree]

> CHECK `chk_email_account_provider`: [object Object]
> CHECK `chk_email_account_status`: [object Object]
> CHECK `chk_email_account_sync_status`: [object Object]

