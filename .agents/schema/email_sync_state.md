# Table: `email_sync_state`

> _⚠ pending annotation_

| Column | Business Name | Type | Class | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| email_sync_state_id | email_sync_state_id | uuid | PK | NOT NULL, DEFAULT uuidv7() |  |
| tenant_id | tenant_id | uuid | — | NOT NULL |  |
| email_account_id | email_account_id | uuid | — | NOT NULL |  |
| scope | scope | text | — | NOT NULL, DEFAULT mailbox |  |
| cursor | cursor | text | — |  |  |
| cursor_json | cursor_json | jsonb | — |  |  |
| status | status | text | — | NOT NULL, DEFAULT idle |  |
| last_synced_at | last_synced_at | timestamp with time zone | — |  |  |
| last_error | last_error | text | — |  |  |
| updated_at | updated_at | timestamp with time zone | — | NOT NULL, DEFAULT now() |  |

> INDEX `idx_email_sync_state_account` (tenant_id, email_account_id) [btree]

> CHECK `chk_email_sync_state_status`: [object Object]

